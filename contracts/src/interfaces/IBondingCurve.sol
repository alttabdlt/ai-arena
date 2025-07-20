// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface IBondingCurve {
    function buy(uint256 minTokens) external payable returns (uint256 tokensOut);
    function sell(uint256 tokensIn, uint256 minEth) external returns (uint256 ethOut);
    function getCurrentPrice() external view returns (uint256);
    function getMarketCap() external view returns (uint256);
    function calculateBuyReturn(uint256 ethIn) external view returns (uint256);
    function calculateSellReturn(uint256 tokensIn) external view returns (uint256);
    
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    
    function creator() external view returns (address);
    function bot() external view returns (address);
    function graduated() external view returns (bool);
    function graduatedAt() external view returns (uint256);
    function totalRaised() external view returns (uint256);
}