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
import type * as aiTown_activityLogger from "../aiTown/activityLogger.js";
import type * as aiTown_agent from "../aiTown/agent.js";
import type * as aiTown_agentDescription from "../aiTown/agentDescription.js";
import type * as aiTown_agentInputs from "../aiTown/agentInputs.js";
import type * as aiTown_agentOperations from "../aiTown/agentOperations.js";
import type * as aiTown_botHttp from "../aiTown/botHttp.js";
import type * as aiTown_conversation from "../aiTown/conversation.js";
import type * as aiTown_conversationMembership from "../aiTown/conversationMembership.js";
import type * as aiTown_experience from "../aiTown/experience.js";
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
import type * as aiTown_movement from "../aiTown/movement.js";
import type * as aiTown_player from "../aiTown/player.js";
import type * as aiTown_playerDescription from "../aiTown/playerDescription.js";
import type * as aiTown_relationshipProgression from "../aiTown/relationshipProgression.js";
import type * as aiTown_relationshipService from "../aiTown/relationshipService.js";
import type * as aiTown_world from "../aiTown/world.js";
import type * as aiTown_worldMap from "../aiTown/worldMap.js";
import type * as aiTown_zoneConfig from "../aiTown/zoneConfig.js";
import type * as cleanup_clearStuckInputs from "../cleanup/clearStuckInputs.js";
import type * as cleanup_documentCleanup from "../cleanup/documentCleanup.js";
import type * as cleanup_emergencyCleanup from "../cleanup/emergencyCleanup.js";
import type * as cleanup_inputCleanup from "../cleanup/inputCleanup.js";
import type * as cleanup_orphanCleanup from "../cleanup/orphanCleanup.js";
import type * as cleanup_orphanCleanupHttp from "../cleanup/orphanCleanupHttp.js";
import type * as cleanup_worldCleanup from "../cleanup/worldCleanup.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as debugging from "../debugging.js";
import type * as engine_abstractGame from "../engine/abstractGame.js";
import type * as engine_historicalObject from "../engine/historicalObject.js";
import type * as engine_rateLimit from "../engine/rateLimit.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as messages from "../messages.js";
import type * as migrations_batchRegistration from "../migrations/batchRegistration.js";
import type * as migrations_migration from "../migrations/migration.js";
import type * as monitoring_systemHealth from "../monitoring/systemHealth.js";
import type * as music from "../music.js";
import type * as queries from "../queries.js";
import type * as testing from "../testing.js";
import type * as util_FastIntegerCompression from "../util/FastIntegerCompression.js";
import type * as util_assertNever from "../util/assertNever.js";
import type * as util_asyncMap from "../util/asyncMap.js";
import type * as util_compression from "../util/compression.js";
import type * as util_geometry from "../util/geometry.js";
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
  "aiTown/activityLogger": typeof aiTown_activityLogger;
  "aiTown/agent": typeof aiTown_agent;
  "aiTown/agentDescription": typeof aiTown_agentDescription;
  "aiTown/agentInputs": typeof aiTown_agentInputs;
  "aiTown/agentOperations": typeof aiTown_agentOperations;
  "aiTown/botHttp": typeof aiTown_botHttp;
  "aiTown/conversation": typeof aiTown_conversation;
  "aiTown/conversationMembership": typeof aiTown_conversationMembership;
  "aiTown/experience": typeof aiTown_experience;
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
  "aiTown/movement": typeof aiTown_movement;
  "aiTown/player": typeof aiTown_player;
  "aiTown/playerDescription": typeof aiTown_playerDescription;
  "aiTown/relationshipProgression": typeof aiTown_relationshipProgression;
  "aiTown/relationshipService": typeof aiTown_relationshipService;
  "aiTown/world": typeof aiTown_world;
  "aiTown/worldMap": typeof aiTown_worldMap;
  "aiTown/zoneConfig": typeof aiTown_zoneConfig;
  "cleanup/clearStuckInputs": typeof cleanup_clearStuckInputs;
  "cleanup/documentCleanup": typeof cleanup_documentCleanup;
  "cleanup/emergencyCleanup": typeof cleanup_emergencyCleanup;
  "cleanup/inputCleanup": typeof cleanup_inputCleanup;
  "cleanup/orphanCleanup": typeof cleanup_orphanCleanup;
  "cleanup/orphanCleanupHttp": typeof cleanup_orphanCleanupHttp;
  "cleanup/worldCleanup": typeof cleanup_worldCleanup;
  constants: typeof constants;
  crons: typeof crons;
  debugging: typeof debugging;
  "engine/abstractGame": typeof engine_abstractGame;
  "engine/historicalObject": typeof engine_historicalObject;
  "engine/rateLimit": typeof engine_rateLimit;
  http: typeof http;
  init: typeof init;
  messages: typeof messages;
  "migrations/batchRegistration": typeof migrations_batchRegistration;
  "migrations/migration": typeof migrations_migration;
  "monitoring/systemHealth": typeof monitoring_systemHealth;
  music: typeof music;
  queries: typeof queries;
  testing: typeof testing;
  "util/FastIntegerCompression": typeof util_FastIntegerCompression;
  "util/assertNever": typeof util_assertNever;
  "util/asyncMap": typeof util_asyncMap;
  "util/compression": typeof util_compression;
  "util/geometry": typeof util_geometry;
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
