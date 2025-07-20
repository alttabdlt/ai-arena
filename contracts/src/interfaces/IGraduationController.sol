// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface IGraduationController {
    function handleGraduation(
        address bondingCurve,
        address bot,
        uint256 totalSupply,
        uint256 ethBalance
    ) external;
}