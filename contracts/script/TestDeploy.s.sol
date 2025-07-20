// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/BondingCurveFactory.sol";
import "../src/BondingCurve.sol";
import "../src/GraduationController.sol";

contract TestDeployScript is Script {
    function run() external {
        // Use a test private key for local testing
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        address treasury = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy contracts
        GraduationController graduationController = new GraduationController();
        BondingCurveFactory factory = new BondingCurveFactory(
            address(graduationController),
            treasury
        );
        graduationController.setFactory(address(factory));
        
        // Test creating a bonding curve
        address testBot = address(0xBEEF);
        address curveAddress = factory.createBondingCurve(
            "Test Bot",
            "TBOT",
            testBot
        );
        
        console.log("Test deployment successful!");
        console.log("Bonding curve created at:", curveAddress);
        
        // Test buying tokens
        BondingCurve curve = BondingCurve(payable(curveAddress));
        uint256 buyAmount = 0.1 ether;
        uint256 expectedTokens = curve.calculateBuyReturn(buyAmount);
        
        console.log("Expected tokens for 0.1 ETH:", expectedTokens);
        
        vm.stopBroadcast();
    }
}