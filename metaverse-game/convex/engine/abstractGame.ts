import { ConvexError, Infer, Value, v } from 'convex/values';
import { internal } from '../_generated/api';
import { Doc, Id } from '../_generated/dataModel';
import { ActionCtx, DatabaseReader, MutationCtx, internalQuery } from '../_generated/server';
import { engine } from '../engine/schema';
import { MAX_INPUTS_PER_ENGINE } from '../constants';

export abstract class AbstractGame {
  abstract tickDuration: number;
  abstract stepDuration: number;
  abstract maxTicksPerStep: number;
  abstract maxInputsPerStep: number;

  constructor(public engine: Doc<'engines'>) {}

  abstract handleInput(now: number, name: string, args: object): Value;
  abstract tick(now: number): void;

  // Optional callback at the beginning of each step.
  beginStep(now: number) {}
  abstract saveStep(ctx: ActionCtx, engineUpdate: EngineUpdate): Promise<void>;

  async runStep(ctx: ActionCtx, now: number) {
    // Use internal API reference with type assertion to avoid deep type instantiation
    // @ts-ignore - TypeScript type depth issue with generated Convex API
    const inputs = await ctx.runQuery(internal.engine.abstractGame.loadInputs, {
      engineId: this.engine._id,
      processedInputNumber: this.engine.processedInputNumber,
      max: this.maxInputsPerStep,
    });

    const lastStepTs = this.engine.currentTime;
    const startTs = lastStepTs ? lastStepTs + this.tickDuration : now;
    let currentTs = startTs;
    let inputIndex = 0;
    let numTicks = 0;
    let processedInputNumber = this.engine.processedInputNumber;
    const completedInputs = [];

    this.beginStep(currentTs);

    while (numTicks < this.maxTicksPerStep) {
      numTicks += 1;

      // Collect all of the inputs for this tick.
      const tickInputs = [];
      while (inputIndex < inputs.length) {
        const input = inputs[inputIndex];
        if (input.received > currentTs) {
          break;
        }
        inputIndex += 1;
        processedInputNumber = input.number;
        tickInputs.push(input);
      }

      // Feed the inputs to the game.
      for (const input of tickInputs) {
        let returnValue;
        try {
          const value = this.handleInput(currentTs, input.name, input.args);
          returnValue = { kind: 'ok' as const, value };
        } catch (e: any) {
          console.error(`Input ${input._id} failed: ${e.message}`);
          returnValue = { kind: 'error' as const, message: e.message };
        }
        completedInputs.push({ inputId: input._id, returnValue });
      }

      // Simulate the game forward one tick.
      this.tick(currentTs);

      const candidateTs = currentTs + this.tickDuration;
      if (now < candidateTs) {
        break;
      }
      currentTs = candidateTs;
    }

    // Commit the step by moving time forward, consuming our inputs, and saving the game's state.
    const expectedGenerationNumber = this.engine.generationNumber;
    this.engine.currentTime = currentTs;
    this.engine.lastStepTs = lastStepTs;
    this.engine.generationNumber += 1;
    this.engine.processedInputNumber = processedInputNumber;
    const { _id, _creationTime, ...engine } = this.engine;
    const engineUpdate = { engine, completedInputs, expectedGenerationNumber };
    await this.saveStep(ctx, engineUpdate);

    // console.debug(`Simulated from ${startTs} to ${currentTs} (${currentTs - startTs}ms)`);
  }
}

const completedInput = v.object({
  inputId: v.id('inputs'),
  returnValue: v.union(
    v.object({
      kind: v.literal('ok'),
      value: v.any(),
    }),
    v.object({
      kind: v.literal('error'),
      message: v.string(),
    }),
  ),
});

export const engineUpdate = v.object({
  engine,
  expectedGenerationNumber: v.number(),
  completedInputs: v.array(completedInput),
});
export type EngineUpdate = Infer<typeof engineUpdate>;

export async function loadEngine(
  db: DatabaseReader,
  engineId: Id<'engines'>,
  generationNumber: number,
) {
  const engine = await db.get(engineId);
  if (!engine) {
    throw new Error(`No engine found with id ${engineId}`);
  }
  if (!engine.running) {
    throw new ConvexError({
      kind: 'engineNotRunning',
      message: `Engine ${engineId} is not running`,
    });
  }
  if (engine.generationNumber !== generationNumber) {
    throw new ConvexError({ kind: 'generationNumber', message: 'Generation number mismatch' });
  }
  return engine;
}

export async function engineInsertInput(
  ctx: MutationCtx,
  engineId: Id<'engines'>,
  name: string,
  args: any,
): Promise<Id<'inputs'>> {
  const now = Date.now();
  const maxRetries = 8;
  let attempt = 0;

  // RATE LIMITING: Check if we have too many unprocessed inputs
  // This prevents input explosions that caused the 32k document limit issues
  const engine = await ctx.db.get(engineId);
  if (!engine) throw new Error(`No engine found with id ${engineId}`);
  
  // Count unprocessed inputs (those without returnValue)
  const unprocessedCount = await ctx.db
    .query('inputs')
    .withIndex('byInputNumber', (q) => 
      q.eq('engineId', engineId).gt('number', engine.processedInputNumber ?? -1)
    )
    .take(MAX_INPUTS_PER_ENGINE + 1)
    .then(inputs => inputs.length);
  
  if (unprocessedCount >= MAX_INPUTS_PER_ENGINE) {
    console.error(`⚠️ RATE LIMIT HIT: ${unprocessedCount} unprocessed inputs for engine ${engineId}, rejecting new input: ${name}`);
    throw new Error(`Rate limit exceeded: Too many unprocessed inputs (${unprocessedCount}/${MAX_INPUTS_PER_ENGINE}). Please wait for the engine to process existing inputs.`);
  }

  // Allocate input numbers using the engine document as a sequence to prevent
  // concurrent writers from racing on the inputs index scan.
  while (attempt < maxRetries) {
    attempt += 1;
    const engine = await ctx.db.get(engineId);
    if (!engine) throw new Error(`No engine found with id ${engineId}`);

    const number = (engine.nextInputNumber ?? 0);
    try {
      // Reserve the number by incrementing on the engine doc first. This write
      // will conflict if another writer updated nextInputNumber concurrently,
      // causing an automatic retry in our loop.
      await ctx.db.patch(engineId, { nextInputNumber: number + 1 });

      // Now insert the input with the reserved number.
      const inputId = await ctx.db.insert('inputs', {
        engineId,
        number,
        name,
        args,
        received: now,
      });
      
      // Log if we're getting close to the limit
      if (unprocessedCount > MAX_INPUTS_PER_ENGINE * 0.8) {
        console.warn(`⚠️ Input buffer at ${Math.round((unprocessedCount / MAX_INPUTS_PER_ENGINE) * 100)}% capacity for engine ${engineId}`);
      }
      
      return inputId;
    } catch (error: any) {
      // OCC conflict on engine.patch or rare input insert collision.
      if (attempt < maxRetries && (
        error?.message?.includes('changed while this mutation was being run') ||
        error?.message?.includes('optimistic concurrency') ||
        error?.message?.includes('OCC')
      )) {
        // Small decorrelated jitter to spread retries
        const backoff = 10 + Math.floor(Math.random() * 40) * attempt;
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      console.error(`[INPUT ERROR] Failed to insert ${name}: ${error?.message ?? error}`);
      throw error;
    }
  }

  throw new Error(`Failed to insert input after ${maxRetries} attempts for ${name}`);
}

export const loadInputs = internalQuery({
  args: {
    engineId: v.id('engines'),
    processedInputNumber: v.optional(v.number()),
    max: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('inputs')
      .withIndex('byInputNumber', (q) =>
        q.eq('engineId', args.engineId).gt('number', args.processedInputNumber ?? -1),
      )
      .order('asc')
      .take(args.max);
  },
});

export const getEngine = internalQuery({
  args: { engineId: v.id('engines') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.engineId);
  },
});

export async function applyEngineUpdate(
  ctx: MutationCtx,
  engineId: Id<'engines'>,
  update: EngineUpdate,
) {
  const engine = await loadEngine(ctx.db, engineId, update.expectedGenerationNumber);
  if (
    engine.currentTime &&
    update.engine.currentTime &&
    update.engine.currentTime < engine.currentTime
  ) {
    throw new Error('Time moving backwards');
  }
  await ctx.db.replace(engine._id, update.engine);

  for (const completedInput of update.completedInputs) {
    const input = await ctx.db.get(completedInput.inputId);
    if (!input) {
      throw new Error(`Input ${completedInput.inputId} not found`);
    }
    if (input.returnValue) {
      throw new Error(`Input ${completedInput.inputId} already completed`);
    }
    input.returnValue = completedInput.returnValue;
    await ctx.db.replace(input._id, input);
  }
}
