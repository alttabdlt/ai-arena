// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../src/BondingCurveFactory.sol";
import "../src/BondingCurve.sol";
import "../src/GraduationController.sol";

contract BondingCurveTest is Test {
    BondingCurveFactory factory;
    GraduationController graduationController;
    
    address treasury = address(0x1234);
    address creator = address(0x5678);
    address buyer = address(0x9999);
    
    function setUp() public {
        graduationController = new GraduationController();
        factory = new BondingCurveFactory(address(graduationController), treasury);
        graduationController.setFactory(address(factory));
        
        vm.deal(creator, 10 ether);
        vm.deal(buyer, 100 ether);
    }
    
    function testCreateBondingCurve() public {
        vm.startPrank(creator);
        
        address bot = address(0xBEEF);
        address curve = factory.createBondingCurve("AI Bot", "AIBOT", bot);
        
        assertEq(factory.botToCurve(bot), curve);
        assertEq(factory.totalCurves(), 1);
        
        BondingCurve bondingCurve = BondingCurve(payable(curve));
        assertEq(bondingCurve.name(), "AI Bot");
        assertEq(bondingCurve.symbol(), "AIBOT");
        assertEq(bondingCurve.creator(), creator);
        assertEq(bondingCurve.bot(), bot);
        
        vm.stopPrank();
    }
    
    function testBuyTokens() public {
        vm.prank(creator);
        address curve = factory.createBondingCurve("AI Bot", "AIBOT", address(0xBEEF));
        BondingCurve bondingCurve = BondingCurve(payable(curve));
        
        vm.startPrank(buyer);
        
        uint256 ethAmount = 1 ether;
        uint256 expectedTokens = bondingCurve.calculateBuyReturn(ethAmount);
        
        uint256 balanceBefore = buyer.balance;
        bondingCurve.buy{value: ethAmount}(expectedTokens);
        uint256 balanceAfter = buyer.balance;
        
        assertEq(balanceBefore - balanceAfter, ethAmount);
        assertGt(bondingCurve.balanceOf(buyer), 0);
        assertEq(bondingCurve.totalSupply(), bondingCurve.balanceOf(buyer));
        
        vm.stopPrank();
    }
    
    function testSellTokens() public {
        vm.prank(creator);
        address curve = factory.createBondingCurve("AI Bot", "AIBOT", address(0xBEEF));
        BondingCurve bondingCurve = BondingCurve(payable(curve));
        
        vm.startPrank(buyer);
        
        // First buy some tokens
        bondingCurve.buy{value: 1 ether}(0);
        uint256 tokenBalance = bondingCurve.balanceOf(buyer);
        
        // Then sell half
        uint256 tokensToSell = tokenBalance / 2;
        uint256 expectedEth = bondingCurve.calculateSellReturn(tokensToSell);
        
        uint256 ethBefore = buyer.balance;
        bondingCurve.sell(tokensToSell, expectedEth);
        uint256 ethAfter = buyer.balance;
        
        assertGt(ethAfter, ethBefore);
        assertEq(bondingCurve.balanceOf(buyer), tokenBalance - tokensToSell);
        
        vm.stopPrank();
    }
}