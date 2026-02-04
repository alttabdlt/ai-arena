// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {WagerEscrow} from "../src/WagerEscrow.sol";
import {ArenaToken} from "../src/ArenaToken.sol";

/// @title DeployMonad
/// @notice Foundry deployment script for AI Arena contracts on Monad.
/// @dev Usage:
///   forge script script/DeployMonad.s.sol:DeployMonad \
///     --rpc-url $MONAD_RPC_URL \
///     --broadcast \
///     --private-key $DEPLOYER_PRIVATE_KEY \
///     -vvvv
///
///   Environment variables:
///     MONAD_RPC_URL          — Monad RPC endpoint
///     DEPLOYER_PRIVATE_KEY   — Private key of deployer
///     TREASURY_ADDRESS       — Treasury address for rake collection
///     DEPLOY_ARENA_TOKEN     — Set to "true" to also deploy the fallback ArenaToken
contract DeployMonad is Script {
    function run() external {
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        bool deployToken = vm.envOr("DEPLOY_ARENA_TOKEN", false);

        vm.startBroadcast();

        // ── Optionally deploy fallback ArenaToken ────────────────────────
        if (deployToken) {
            ArenaToken token = new ArenaToken();
            console.log("ArenaToken deployed at:", address(token));
        }

        // ── Deploy WagerEscrow ───────────────────────────────────────────
        WagerEscrow escrow = new WagerEscrow(treasury);
        console.log("WagerEscrow deployed at:", address(escrow));
        console.log("  owner:   ", escrow.owner());
        console.log("  treasury:", escrow.treasury());
        console.log("  rake:    ", escrow.rakePercent(), "%");

        vm.stopBroadcast();
    }
}
