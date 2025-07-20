// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/BondingCurveFactory.sol";
import "../src/GraduationController.sol";

contract DeployScript is Script {
    // HyperEVM Chain IDs
    uint256 constant HYPEREVM_TESTNET_CHAIN_ID = 998;
    uint256 constant HYPEREVM_MAINNET_CHAIN_ID = 999;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        
        // Get current chain ID to confirm we're on testnet
        uint256 chainId = block.chainid;
        require(chainId == HYPEREVM_TESTNET_CHAIN_ID, "Not on HyperEVM Testnet! Expected chain ID 998");
        
        console.log("Deploying contracts to HyperEVM Testnet (Chain ID: 998)...");
        console.log("Treasury address:", treasury);
        console.log("Deployer address:", vm.addr(deployerPrivateKey));
        console.log("Deployer HYPE balance:", vm.addr(deployerPrivateKey).balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy GraduationController first
        GraduationController graduationController = new GraduationController();
        console.log("GraduationController deployed at:", address(graduationController));
        
        // Deploy BondingCurveFactory
        BondingCurveFactory factory = new BondingCurveFactory(
            address(graduationController),
            treasury
        );
        console.log("BondingCurveFactory deployed at:", address(factory));
        
        // Update factory address in GraduationController
        graduationController.setFactory(address(factory));
        console.log("Factory address set in GraduationController");
        
        vm.stopBroadcast();
        
        // Log deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("GraduationController:", address(graduationController));
        console.log("BondingCurveFactory:", address(factory));
        console.log("Treasury:", treasury);
        console.log("========================\n");
        
        // Write deployment addresses to file for easy reference
        string memory deploymentInfo = string(abi.encodePacked(
            "GRADUATION_CONTROLLER_ADDRESS=", vm.toString(address(graduationController)), "\n",
            "BONDING_CURVE_FACTORY_ADDRESS=", vm.toString(address(factory)), "\n",
            "TREASURY_ADDRESS=", vm.toString(treasury), "\n"
        ));
        
        vm.writeFile("./deployment-addresses.txt", deploymentInfo);
        console.log("Deployment addresses written to deployment-addresses.txt");
    }
}