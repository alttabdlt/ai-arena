// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./interfaces/IBondingCurve.sol";
import "./interfaces/IGraduationController.sol";
import "./lib/ReentrancyGuard.sol";

contract BondingCurve is IBondingCurve, ReentrancyGuard {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    address public immutable creator;
    address public immutable bot;
    address public immutable treasury;
    address public immutable graduationController;
    
    uint256 public constant CURVE_CONSTANT = 3000000000000000; // 0.003 * 10^18
    uint256 public constant CURVE_EXPONENT_NUM = 3; // 1.5 = 3/2
    uint256 public constant CURVE_EXPONENT_DEN = 2;
    uint256 public constant GRADUATION_THRESHOLD = 69000 * 10**18; // $69k market cap
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18; // 1B tokens
    uint256 public constant PLATFORM_FEE_BPS = 100; // 1%
    uint256 public constant CREATOR_FEE_BPS = 200; // 2%
    uint256 public constant MAX_BUY_PER_TX = 10000 * 10**18; // Anti-bot: max 10k tokens per tx
    uint256 public constant COOLDOWN_PERIOD = 30; // 30 seconds between buys
    
    bool public graduated;
    uint256 public graduatedAt;
    uint256 public totalRaised;
    mapping(address => uint256) public lastBuyTime;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Buy(address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 newPrice);
    event Sell(address indexed seller, uint256 tokensIn, uint256 ethOut, uint256 newPrice);
    event Graduated(uint256 finalSupply, uint256 totalRaised);
    
    modifier notGraduated() {
        require(!graduated, "Curve: graduated");
        _;
    }
    
    constructor(
        string memory _name,
        string memory _symbol,
        address _creator,
        address _bot,
        address _treasury,
        address _graduationController
    ) {
        name = _name;
        symbol = _symbol;
        creator = _creator;
        bot = _bot;
        treasury = _treasury;
        graduationController = _graduationController;
    }
    
    function buy(uint256 minTokens) external payable nonReentrant notGraduated returns (uint256 tokensOut) {
        require(msg.value > 0, "Curve: zero ETH");
        require(block.timestamp >= lastBuyTime[msg.sender] + COOLDOWN_PERIOD, "Curve: cooldown");
        
        uint256 ethAfterFees = _takeFees(msg.value);
        tokensOut = _calculateBuyReturn(ethAfterFees);
        
        require(tokensOut >= minTokens, "Curve: slippage");
        require(tokensOut <= MAX_BUY_PER_TX, "Curve: max buy exceeded");
        require(totalSupply + tokensOut <= MAX_SUPPLY, "Curve: max supply");
        
        totalSupply += tokensOut;
        balanceOf[msg.sender] += tokensOut;
        totalRaised += msg.value;
        lastBuyTime[msg.sender] = block.timestamp;
        
        emit Transfer(address(0), msg.sender, tokensOut);
        emit Buy(msg.sender, msg.value, tokensOut, getCurrentPrice());
        
        _checkGraduation();
    }
    
    function sell(uint256 tokensIn, uint256 minEth) external nonReentrant notGraduated returns (uint256 ethOut) {
        require(tokensIn > 0, "Curve: zero tokens");
        require(balanceOf[msg.sender] >= tokensIn, "Curve: insufficient balance");
        
        ethOut = _calculateSellReturn(tokensIn);
        uint256 ethAfterFees = _takeFees(ethOut);
        
        require(ethAfterFees >= minEth, "Curve: slippage");
        require(address(this).balance >= ethAfterFees, "Curve: insufficient ETH");
        
        totalSupply -= tokensIn;
        balanceOf[msg.sender] -= tokensIn;
        
        (bool success,) = msg.sender.call{value: ethAfterFees}("");
        require(success, "Curve: ETH transfer failed");
        
        emit Transfer(msg.sender, address(0), tokensIn);
        emit Sell(msg.sender, tokensIn, ethAfterFees, getCurrentPrice());
    }
    
    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= value, "Curve: insufficient allowance");
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }
    
    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }
    
    function getCurrentPrice() public view returns (uint256) {
        if (totalSupply == 0) return CURVE_CONSTANT;
        return _priceAtSupply(totalSupply);
    }
    
    function getMarketCap() public view returns (uint256) {
        return (totalSupply * getCurrentPrice()) / 10**18;
    }
    
    function calculateBuyReturn(uint256 ethIn) external view returns (uint256) {
        uint256 ethAfterFees = (ethIn * (10000 - PLATFORM_FEE_BPS - CREATOR_FEE_BPS)) / 10000;
        return _calculateBuyReturn(ethAfterFees);
    }
    
    function calculateSellReturn(uint256 tokensIn) external view returns (uint256) {
        uint256 ethBeforeFees = _calculateSellReturn(tokensIn);
        return (ethBeforeFees * (10000 - PLATFORM_FEE_BPS - CREATOR_FEE_BPS)) / 10000;
    }
    
    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "Curve: transfer to zero");
        require(balanceOf[from] >= value, "Curve: insufficient balance");
        
        balanceOf[from] -= value;
        balanceOf[to] += value;
        
        emit Transfer(from, to, value);
    }
    
    function _calculateBuyReturn(uint256 ethIn) internal view returns (uint256) {
        uint256 newSupply = _supplyAtPrice(_priceAtSupply(totalSupply) + ethIn);
        return newSupply > totalSupply ? newSupply - totalSupply : 0;
    }
    
    function _calculateSellReturn(uint256 tokensIn) internal view returns (uint256) {
        if (tokensIn >= totalSupply) return address(this).balance;
        uint256 newSupply = totalSupply - tokensIn;
        uint256 oldPrice = _integralAtSupply(totalSupply);
        uint256 newPrice = _integralAtSupply(newSupply);
        return oldPrice > newPrice ? oldPrice - newPrice : 0;
    }
    
    function _priceAtSupply(uint256 supply) internal pure returns (uint256) {
        if (supply == 0) return CURVE_CONSTANT;
        return (CURVE_CONSTANT * _pow(supply, CURVE_EXPONENT_NUM, CURVE_EXPONENT_DEN)) / 10**18;
    }
    
    function _supplyAtPrice(uint256 price) internal pure returns (uint256) {
        if (price <= CURVE_CONSTANT) return 0;
        return _pow((price * 10**18) / CURVE_CONSTANT, CURVE_EXPONENT_DEN, CURVE_EXPONENT_NUM);
    }
    
    function _integralAtSupply(uint256 supply) internal pure returns (uint256) {
        if (supply == 0) return 0;
        return (CURVE_CONSTANT * _pow(supply, CURVE_EXPONENT_NUM + CURVE_EXPONENT_DEN, CURVE_EXPONENT_DEN)) / 
               ((CURVE_EXPONENT_NUM + CURVE_EXPONENT_DEN) * 10**18);
    }
    
    function _pow(uint256 base, uint256 expNum, uint256 expDen) internal pure returns (uint256) {
        if (expNum == expDen) return base;
        if (expNum == 0) return 10**18;
        
        uint256 result = 10**18;
        uint256 basePow = base;
        
        while (expNum > 0) {
            if (expNum % 2 == 1) {
                result = (result * basePow) / 10**18;
            }
            basePow = (basePow * basePow) / 10**18;
            expNum /= 2;
        }
        
        if (expDen > 1) {
            result = _nthRoot(result, expDen);
        }
        
        return result;
    }
    
    function _nthRoot(uint256 a, uint256 n) internal pure returns (uint256) {
        if (a == 0) return 0;
        if (n == 1) return a;
        
        uint256 x = a;
        uint256 x1;
        
        while (true) {
            x1 = ((n - 1) * x + a / (x ** (n - 1))) / n;
            if (x1 >= x) return x;
            x = x1;
        }
    }
    
    function _takeFees(uint256 amount) internal returns (uint256) {
        uint256 platformFee = (amount * PLATFORM_FEE_BPS) / 10000;
        uint256 creatorFee = (amount * CREATOR_FEE_BPS) / 10000;
        
        if (platformFee > 0) {
            (bool success1,) = treasury.call{value: platformFee}("");
            require(success1, "Curve: platform fee failed");
        }
        
        if (creatorFee > 0) {
            (bool success2,) = creator.call{value: creatorFee}("");
            require(success2, "Curve: creator fee failed");
        }
        
        return amount - platformFee - creatorFee;
    }
    
    function _checkGraduation() internal {
        if (getMarketCap() >= GRADUATION_THRESHOLD && !graduated) {
            graduated = true;
            graduatedAt = block.timestamp;
            
            emit Graduated(totalSupply, totalRaised);
            
            IGraduationController(graduationController).handleGraduation(
                address(this),
                bot,
                totalSupply,
                address(this).balance
            );
        }
    }
    
    receive() external payable {}
}