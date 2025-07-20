// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./interfaces/IGraduationController.sol";
import "./interfaces/IBondingCurve.sol";

contract GraduationController is IGraduationController {
    address public factory;
    address public vaultFactory;
    
    struct GraduationData {
        address bondingCurve;
        address bot;
        uint256 totalSupply;
        uint256 ethRaised;
        uint256 timestamp;
        address vault;
    }
    
    mapping(address => GraduationData) public graduations;
    address[] public graduatedBots;
    
    event BotGraduated(
        address indexed bondingCurve,
        address indexed bot,
        address indexed vault,
        uint256 totalSupply,
        uint256 ethRaised
    );
    
    modifier onlyBondingCurve() {
        require(msg.sender == IBondingCurve(msg.sender).bot(), "GraduationController: not bonding curve");
        _;
    }
    
    constructor() {
        // Factory will be set after deployment
    }
    
    function setFactory(address _factory) external {
        require(factory == address(0), "GraduationController: factory already set");
        require(_factory != address(0), "GraduationController: zero factory");
        factory = _factory;
    }
    
    function handleGraduation(
        address bondingCurve,
        address bot,
        uint256 totalSupply,
        uint256 ethBalance
    ) external onlyBondingCurve {
        require(graduations[bot].timestamp == 0, "GraduationController: already graduated");
        
        // For MVP, we'll just store the graduation data
        // In production, this would:
        // 1. Deploy liquidity to Uniswap V3
        // 2. Create a vault contract
        // 3. Transfer ownership to vault manager
        
        graduations[bot] = GraduationData({
            bondingCurve: bondingCurve,
            bot: bot,
            totalSupply: totalSupply,
            ethRaised: ethBalance,
            timestamp: block.timestamp,
            vault: address(0) // Will be set when vault system is implemented
        });
        
        graduatedBots.push(bot);
        
        emit BotGraduated(bondingCurve, bot, address(0), totalSupply, ethBalance);
    }
    
    function getGraduatedBots() external view returns (address[] memory) {
        return graduatedBots;
    }
    
    function totalGraduated() external view returns (uint256) {
        return graduatedBots.length;
    }
    
    function setVaultFactory(address _vaultFactory) external {
        require(vaultFactory == address(0), "GraduationController: vault factory already set");
        require(_vaultFactory != address(0), "GraduationController: zero vault factory");
        vaultFactory = _vaultFactory;
    }
}