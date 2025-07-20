// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface IBondingCurveFactory {
    function createBondingCurve(
        string calldata name,
        string calldata symbol,
        address bot
    ) external returns (address curve);
    
    function getCurvesByCreator(address creator) external view returns (address[] memory);
    function getAllCurves() external view returns (address[] memory);
    function totalCurves() external view returns (uint256);
    function botToCurve(address bot) external view returns (address);
    function graduationController() external view returns (address);
    function treasury() external view returns (address);
}