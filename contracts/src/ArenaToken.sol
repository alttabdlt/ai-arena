// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title ArenaToken
/// @notice Minimal ERC-20 token — 1 billion $ARENA minted to deployer.
/// @dev Self-contained, no imports. Fallback token if nad.fun launch doesn't work out.
contract ArenaToken {
    string public constant name = "Arena Token";
    string public constant symbol = "ARENA";
    uint8 public constant decimals = 18;
    uint256 public constant totalSupply = 1_000_000_000 * 1e18; // 1B tokens

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        return _transfer(msg.sender, to, value);
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= value, "ArenaToken: allowance exceeded");
            allowance[from][msg.sender] = allowed - value;
        }
        return _transfer(from, to, value);
    }

    function _transfer(
        address from,
        address to,
        uint256 value
    ) private returns (bool) {
        require(from != address(0), "ArenaToken: transfer from zero");
        require(to != address(0), "ArenaToken: transfer to zero");
        require(balanceOf[from] >= value, "ArenaToken: insufficient balance");

        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
        return true;
    }
}
