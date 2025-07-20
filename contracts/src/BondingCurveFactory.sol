// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./BondingCurve.sol";
import "./interfaces/IBondingCurveFactory.sol";

contract BondingCurveFactory is IBondingCurveFactory {
    address public immutable graduationController;
    address public treasury;
    uint256 public constant PLATFORM_FEE_BPS = 100; // 1%
    uint256 public constant CREATOR_FEE_BPS = 200; // 2%
    
    mapping(address => address[]) public creatorToCurves;
    mapping(address => address) public botToCurve;
    address[] public allCurves;
    
    bool public paused;
    
    event CurveCreated(
        address indexed curve,
        address indexed bot,
        address indexed creator,
        string name,
        string symbol
    );
    
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event EmergencyPause(bool paused);
    
    modifier whenNotPaused() {
        require(!paused, "Factory: paused");
        _;
    }
    
    modifier onlyOwner() {
        require(msg.sender == treasury, "Factory: not owner");
        _;
    }
    
    constructor(address _graduationController, address _treasury) {
        require(_graduationController != address(0), "Factory: zero graduation controller");
        require(_treasury != address(0), "Factory: zero treasury");
        graduationController = _graduationController;
        treasury = _treasury;
    }
    
    function createBondingCurve(
        string calldata name,
        string calldata symbol,
        address bot
    ) external whenNotPaused returns (address curve) {
        require(bot != address(0), "Factory: zero bot address");
        require(botToCurve[bot] == address(0), "Factory: curve exists");
        require(bytes(name).length > 0, "Factory: empty name");
        require(bytes(symbol).length > 0, "Factory: empty symbol");
        
        curve = address(new BondingCurve(
            name,
            symbol,
            msg.sender,
            bot,
            treasury,
            graduationController
        ));
        
        creatorToCurves[msg.sender].push(curve);
        botToCurve[bot] = curve;
        allCurves.push(curve);
        
        emit CurveCreated(curve, bot, msg.sender, name, symbol);
    }
    
    function getCurvesByCreator(address creator) external view returns (address[] memory) {
        return creatorToCurves[creator];
    }
    
    function getAllCurves() external view returns (address[] memory) {
        return allCurves;
    }
    
    function totalCurves() external view returns (uint256) {
        return allCurves.length;
    }
    
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Factory: zero treasury");
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }
    
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit EmergencyPause(_paused);
    }
}