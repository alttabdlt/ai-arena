/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as agent_conversation from "../agent/conversation.js";
import type * as agent_embeddingsCache from "../agent/embeddingsCache.js";
import type * as agent_memory from "../agent/memory.js";
import type * as aiTown_activityHooks from "../aiTown/activityHooks.js";
import type * as aiTown_activityLogger from "../aiTown/activityLogger.js";
import type * as aiTown_agent from "../aiTown/agent.js";
import type * as aiTown_agentDescription from "../aiTown/agentDescription.js";
import type * as aiTown_agentInputs from "../aiTown/agentInputs.js";
import type * as aiTown_agentOperations from "../aiTown/agentOperations.js";
import type * as aiTown_batchRegistration from "../aiTown/batchRegistration.js";
import type * as aiTown_botHttp from "../aiTown/botHttp.js";
import type * as aiTown_clearAgents from "../aiTown/clearAgents.js";
import type * as aiTown_conversation from "../aiTown/conversation.js";
import type * as aiTown_conversationMembership from "../aiTown/conversationMembership.js";
import type * as aiTown_experience from "../aiTown/experience.js";
import type * as aiTown_fixWorldInstances from "../aiTown/fixWorldInstances.js";
import type * as aiTown_game from "../aiTown/game.js";
import type * as aiTown_idleGains from "../aiTown/idleGains.js";
import type * as aiTown_idleLoot from "../aiTown/idleLoot.js";
import type * as aiTown_ids from "../aiTown/ids.js";
import type * as aiTown_inputHandler from "../aiTown/inputHandler.js";
import type * as aiTown_inputs from "../aiTown/inputs.js";
import type * as aiTown_insertInput from "../aiTown/insertInput.js";
import type * as aiTown_instanceManager from "../aiTown/instanceManager.js";
import type * as aiTown_inventory from "../aiTown/inventory.js";
import type * as aiTown_location from "../aiTown/location.js";
import type * as aiTown_main from "../aiTown/main.js";
import type * as aiTown_migration from "../aiTown/migration.js";
import type * as aiTown_movement from "../aiTown/movement.js";
import type * as aiTown_orphanCleanup from "../aiTown/orphanCleanup.js";
import type * as aiTown_orphanCleanupHttp from "../aiTown/orphanCleanupHttp.js";
import type * as aiTown_player from "../aiTown/player.js";
import type * as aiTown_playerDescription from "../aiTown/playerDescription.js";
import type * as aiTown_relationshipProgression from "../aiTown/relationshipProgression.js";
import type * as aiTown_relationshipService from "../aiTown/relationshipService.js";
import type * as aiTown_simpleWorldCleanup from "../aiTown/simpleWorldCleanup.js";
import type * as aiTown_testLootbox from "../aiTown/testLootbox.js";
import type * as aiTown_testRelationship from "../aiTown/testRelationship.js";
import type * as aiTown_world from "../aiTown/world.js";
import type * as aiTown_worldCleanup from "../aiTown/worldCleanup.js";
import type * as aiTown_worldMap from "../aiTown/worldMap.js";
import type * as aiTown_zoneConfig from "../aiTown/zoneConfig.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as debugging from "../debugging.js";
import type * as engine_abstractGame from "../engine/abstractGame.js";
import type * as engine_historicalObject from "../engine/historicalObject.js";
import type * as http from "../http.js";
import type * as init_createWorldInstances from "../init/createWorldInstances.js";
import type * as init from "../init.js";
import type * as initWorld from "../initWorld.js";
import type * as messages from "../messages.js";
import type * as music from "../music.js";
import type * as queries from "../queries.js";
import type * as testing_clearStuckInputs from "../testing/clearStuckInputs.js";
import type * as testing_debug from "../testing/debug.js";
import type * as testing from "../testing.js";
import type * as util_FastIntegerCompression from "../util/FastIntegerCompression.js";
import type * as util_assertNever from "../util/assertNever.js";
import type * as util_asyncMap from "../util/asyncMap.js";
import type * as util_compression from "../util/compression.js";
import type * as util_geometry from "../util/geometry.js";
import type * as util_isSimpleObject from "../util/isSimpleObject.js";
import type * as util_llm from "../util/llm.js";
import type * as util_minheap from "../util/minheap.js";
import type * as util_object from "../util/object.js";
import type * as util_sleep from "../util/sleep.js";
import type * as util_types from "../util/types.js";
import type * as util_xxhash from "../util/xxhash.js";
import type * as world from "../world.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "agent/conversation": typeof agent_conversation;
  "agent/embeddingsCache": typeof agent_embeddingsCache;
  "agent/memory": typeof agent_memory;
  "aiTown/activityHooks": typeof aiTown_activityHooks;
  "aiTown/activityLogger": typeof aiTown_activityLogger;
  "aiTown/agent": typeof aiTown_agent;
  "aiTown/agentDescription": typeof aiTown_agentDescription;
  "aiTown/agentInputs": typeof aiTown_agentInputs;
  "aiTown/agentOperations": typeof aiTown_agentOperations;
  "aiTown/batchRegistration": typeof aiTown_batchRegistration;
  "aiTown/botHttp": typeof aiTown_botHttp;
  "aiTown/clearAgents": typeof aiTown_clearAgents;
  "aiTown/conversation": typeof aiTown_conversation;
  "aiTown/conversationMembership": typeof aiTown_conversationMembership;
  "aiTown/experience": typeof aiTown_experience;
  "aiTown/fixWorldInstances": typeof aiTown_fixWorldInstances;
  "aiTown/game": typeof aiTown_game;
  "aiTown/idleGains": typeof aiTown_idleGains;
  "aiTown/idleLoot": typeof aiTown_idleLoot;
  "aiTown/ids": typeof aiTown_ids;
  "aiTown/inputHandler": typeof aiTown_inputHandler;
  "aiTown/inputs": typeof aiTown_inputs;
  "aiTown/insertInput": typeof aiTown_insertInput;
  "aiTown/instanceManager": typeof aiTown_instanceManager;
  "aiTown/inventory": typeof aiTown_inventory;
  "aiTown/location": typeof aiTown_location;
  "aiTown/main": typeof aiTown_main;
  "aiTown/migration": typeof aiTown_migration;
  "aiTown/movement": typeof aiTown_movement;
  "aiTown/orphanCleanup": typeof aiTown_orphanCleanup;
  "aiTown/orphanCleanupHttp": typeof aiTown_orphanCleanupHttp;
  "aiTown/player": typeof aiTown_player;
  "aiTown/playerDescription": typeof aiTown_playerDescription;
  "aiTown/relationshipProgression": typeof aiTown_relationshipProgression;
  "aiTown/relationshipService": typeof aiTown_relationshipService;
  "aiTown/simpleWorldCleanup": typeof aiTown_simpleWorldCleanup;
  "aiTown/testLootbox": typeof aiTown_testLootbox;
  "aiTown/testRelationship": typeof aiTown_testRelationship;
  "aiTown/world": typeof aiTown_world;
  "aiTown/worldCleanup": typeof aiTown_worldCleanup;
  "aiTown/worldMap": typeof aiTown_worldMap;
  "aiTown/zoneConfig": typeof aiTown_zoneConfig;
  constants: typeof constants;
  crons: typeof crons;
  debugging: typeof debugging;
  "engine/abstractGame": typeof engine_abstractGame;
  "engine/historicalObject": typeof engine_historicalObject;
  http: typeof http;
  "init/createWorldInstances": typeof init_createWorldInstances;
  init: typeof init;
  initWorld: typeof initWorld;
  messages: typeof messages;
  music: typeof music;
  queries: typeof queries;
  "testing/clearStuckInputs": typeof testing_clearStuckInputs;
  "testing/debug": typeof testing_debug;
  testing: typeof testing;
  "util/FastIntegerCompression": typeof util_FastIntegerCompression;
  "util/assertNever": typeof util_assertNever;
  "util/asyncMap": typeof util_asyncMap;
  "util/compression": typeof util_compression;
  "util/geometry": typeof util_geometry;
  "util/isSimpleObject": typeof util_isSimpleObject;
  "util/llm": typeof util_llm;
  "util/minheap": typeof util_minheap;
  "util/object": typeof util_object;
  "util/sleep": typeof util_sleep;
  "util/types": typeof util_types;
  "util/xxhash": typeof util_xxhash;
  world: typeof world;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
