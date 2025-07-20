// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/BondingCurveFactory.sol";
import "../src/GraduationController.sol";

contract DeployMainnetScript is Script {
    uint256 constant HYPEREVM_MAINNET_CHAIN_ID = 999;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        
        // Safety check - require explicit confirmation
        require(
            vm.envBool("CONFIRM_MAINNET_DEPLOYMENT"),
            "Set CONFIRM_MAINNET_DEPLOYMENT=true to deploy to mainnet"
        );
        
        // Verify we're on mainnet
        uint256 chainId = block.chainid;
        require(chainId == HYPEREVM_MAINNET_CHAIN_ID, "Not on HyperEVM Mainnet! Expected chain ID 999");
        
        console.log("====================================");
        console.log("DEPLOYING TO HYPEREVM MAINNET!");
        console.log("====================================");
        console.log("Chain ID:", chainId);
        console.log("Treasury address:", treasury);
        console.log("Deployer address:", vm.addr(deployerPrivateKey));
        console.log("Deployer HYPE balance:", vm.addr(deployerPrivateKey).balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy GraduationController
        GraduationController graduationController = new GraduationController();
        console.log("GraduationController deployed at:", address(graduationController));
        
        // Deploy BondingCurveFactory
        BondingCurveFactory factory = new BondingCurveFactory(
            address(graduationController),
            treasury
        );
        console.log("BondingCurveFactory deployed at:", address(factory));
        
        // Link factory to graduation controller
        graduationController.setFactory(address(factory));
        console.log("Factory address set in GraduationController");
        
        vm.stopBroadcast();
        
        // Log deployment summary
        console.log("\n=== MAINNET Deployment Summary ===");
        console.log("Network: HyperEVM Mainnet (999)");
        console.log("GraduationController:", address(graduationController));
        console.log("BondingCurveFactory:", address(factory));
        console.log("Treasury:", treasury);
        console.log("=================================\n");
        
        // Write deployment info
        string memory deploymentInfo = string(abi.encodePacked(
            "NETWORK=HyperEVM_Mainnet\n",
            "CHAIN_ID=999\n",
            "GRADUATION_CONTROLLER_ADDRESS=", vm.toString(address(graduationController)), "\n",
            "BONDING_CURVE_FACTORY_ADDRESS=", vm.toString(address(factory)), "\n",
            "TREASURY_ADDRESS=", vm.toString(treasury), "\n",
            "DEPLOYED_AT=", vm.toString(block.timestamp), "\n"
        ));
        
        vm.writeFile("./mainnet-deployment.txt", deploymentInfo);
        console.log("Mainnet deployment addresses written to mainnet-deployment.txt");
    }
}