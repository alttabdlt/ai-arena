/**
 * Test script: AI Town agent loop E2E test.
 * Registers agents, creates a town, runs one tick to see autonomous decisions.
 */

const BASE = 'http://localhost:4000/api/v1';

interface Agent {
  id: string;
  name: string;
  archetype: string;
  apiKey: string;
  bankroll: number;
}

async function json(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  return res.json();
}

async function main() {
  console.log('🏘️  AI Town E2E Test\n');

  // 1. Register agents
  console.log('=== Registering agents ===');
  const agentConfigs = [
    { name: 'AlphaBuilder', archetype: 'SHARK', modelId: 'deepseek-v3' },
    { name: 'SteadySteve', archetype: 'ROCK', modelId: 'deepseek-v3' },
    { name: 'ChaosCarla', archetype: 'DEGEN', modelId: 'deepseek-v3' },
  ];

  const agents: Agent[] = [];
  for (const config of agentConfigs) {
    try {
      const agent = await json(`${BASE}/agents/register`, {
        method: 'POST',
        body: JSON.stringify(config),
      });
      if (agent.error) {
        console.log(`  ⚠️  ${config.name}: ${agent.error}`);
        // Try to find existing agent
        const allAgents = await json(`${BASE}/agents`);
        const existing = allAgents.agents?.find((a: any) => a.name === config.name);
        if (existing) {
          agents.push({ ...existing, apiKey: '(existing)' });
          console.log(`  📎 Using existing ${config.name} (${existing.id})`);
        }
      } else {
        agents.push(agent);
        console.log(`  ✅ ${agent.name} (${agent.archetype}) — ${agent.bankroll} $ARENA`);
      }
    } catch (err: any) {
      console.error(`  ❌ Failed to register ${config.name}:`, err.message);
    }
  }

  if (agents.length === 0) {
    console.error('No agents registered. Aborting.');
    process.exit(1);
  }

  // 2. Create a town
  console.log('\n=== Creating town ===');
  let town;
  const existingTown = await json(`${BASE}/town`);
  if (existingTown.town) {
    town = existingTown.town;
    console.log(`  📎 Using existing town: ${town.name} (${town.status}, ${town.completionPct.toFixed(1)}%)`);
  } else {
    const created = await json(`${BASE}/town`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Arenaville', theme: 'medieval trading hub' }),
    });
    town = created.town;
    console.log(`  ✅ Created: ${town.name} (${town.theme}, ${town.totalPlots} plots)`);
  }

  // Show plot distribution
  const plotsByZone: Record<string, number> = {};
  for (const plot of town.plots) {
    plotsByZone[plot.zone] = (plotsByZone[plot.zone] || 0) + 1;
  }
  console.log(`  📊 Zones: ${Object.entries(plotsByZone).map(([z, c]) => `${z}:${c}`).join(', ')}`);

  // 3. Run one tick
  console.log('\n=== Running agent tick ===');
  console.log('  (Each agent will observe the world, reason about what to do, and execute)\n');

  const tickResult = await json(`${BASE}/agent-loop/tick`, { method: 'POST' });

  if (tickResult.error) {
    console.error('Tick error:', tickResult.error);
    process.exit(1);
  }

  for (const result of tickResult.results) {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.agentName} → ${result.action.type}`);
    console.log(`   💭 "${result.action.reasoning}"`);
    console.log(`   📝 ${result.narrative}`);
    if (result.cost) {
      console.log(`   💰 Cost: $${(result.cost.costCents / 100).toFixed(4)} (${result.cost.latencyMs}ms)`);
    }
    if (result.error) {
      console.log(`   ⚠️  Error: ${result.error}`);
    }
    console.log();
  }

  // 4. Check town progress
  console.log('=== Town Progress ===');
  const progress = await json(`${BASE}/town/${town.id}/progress`);
  console.log(`  ${progress.name}: ${progress.completion.toFixed(1)}% complete`);
  console.log(`  Built: ${progress.plotsBuilt}/${progress.totalPlots}`);
  console.log(`  Total invested: ${progress.totalInvested} $ARENA`);
  console.log(`  Total API calls: ${progress.totalApiCalls}`);

  // 5. Check events
  console.log('\n=== Recent Events ===');
  const events = await json(`${BASE}/town/${town.id}/events?limit=10`);
  for (const event of events.events.slice(0, 8)) {
    console.log(`  ${event.title}`);
  }

  // 6. World stats
  console.log('\n=== World Stats ===');
  const stats = await json(`${BASE}/world/stats`);
  console.log(`  Towns: ${stats.totalTowns} (${stats.completedTowns} complete, ${stats.buildingTowns} building)`);
  console.log(`  Agents: ${stats.totalAgents}`);
  console.log(`  Total invested: ${stats.totalArenaInvested} $ARENA`);
  console.log(`  Total API calls: ${stats.totalApiCalls}`);
  console.log(`  Total API cost: $${(stats.totalApiCostCents / 100).toFixed(4)}`);
}

main().catch(console.error);
