// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title WagerEscrow
/// @notice Match-based escrow for ERC-20 wagers between two players on Monad.
/// @dev Self-contained — no external imports. Inline ReentrancyGuard + Ownable patterns.
contract WagerEscrow {
    // ─── Reentrancy Guard ────────────────────────────────────────────────
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    // ─── Ownable ─────────────────────────────────────────────────────────
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "WagerEscrow: caller is not owner");
        _;
    }

    // ─── Pausable ────────────────────────────────────────────────────────
    bool public paused;

    modifier whenNotPaused() {
        require(!paused, "WagerEscrow: paused");
        _;
    }

    // ─── Types ───────────────────────────────────────────────────────────
    enum MatchStatus {
        Created,   // player1 deposited, waiting for opponent
        Active,    // both players deposited, match in progress
        Resolved,  // winner paid out
        Cancelled  // refunded
    }

    struct Match {
        address player1;
        address player2;
        address token;
        uint256 wagerAmount;
        MatchStatus status;
        uint256 createdAt;
    }

    // ─── State ───────────────────────────────────────────────────────────
    mapping(bytes32 => Match) public matches;

    address public treasury;
    uint256 public rakePercent = 5; // basis: 100 (i.e. 5%)
    uint256 public constant TIMEOUT_DURATION = 1 hours;

    // ─── Events ──────────────────────────────────────────────────────────
    event MatchCreated(
        bytes32 indexed matchId,
        address indexed player1,
        address token,
        uint256 wagerAmount
    );
    event MatchJoined(bytes32 indexed matchId, address indexed player2);
    event MatchResolved(
        bytes32 indexed matchId,
        address indexed winner,
        uint256 payout,
        uint256 rake
    );
    event MatchCancelled(bytes32 indexed matchId);
    event TimeoutClaimed(bytes32 indexed matchId, address indexed player1);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event RakePercentUpdated(uint256 oldRake, uint256 newRake);
    event Paused(address account);
    event Unpaused(address account);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(address _treasury) {
        require(_treasury != address(0), "WagerEscrow: zero treasury");
        owner = msg.sender;
        treasury = _treasury;
    }

    // ─── Player Functions ────────────────────────────────────────────────

    /// @notice Player 1 creates a match and deposits the wager.
    /// @param matchId Unique identifier for the match (e.g. keccak256 of game metadata).
    /// @param token   ERC-20 token used for the wager ($ARENA).
    /// @param wagerAmount Amount each player must deposit.
    function createMatch(
        bytes32 matchId,
        address token,
        uint256 wagerAmount
    ) external whenNotPaused nonReentrant {
        require(wagerAmount > 0, "WagerEscrow: zero wager");
        require(token != address(0), "WagerEscrow: zero token");
        require(matches[matchId].createdAt == 0, "WagerEscrow: match exists");

        matches[matchId] = Match({
            player1: msg.sender,
            player2: address(0),
            token: token,
            wagerAmount: wagerAmount,
            status: MatchStatus.Created,
            createdAt: block.timestamp
        });

        _safeTransferFrom(token, msg.sender, address(this), wagerAmount);

        emit MatchCreated(matchId, msg.sender, token, wagerAmount);
    }

    /// @notice Player 2 joins an existing match and deposits the equal wager.
    /// @param matchId The match to join.
    function joinMatch(bytes32 matchId) external whenNotPaused nonReentrant {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.Created, "WagerEscrow: not joinable");
        require(m.player1 != msg.sender, "WagerEscrow: cannot join own match");

        m.player2 = msg.sender;
        m.status = MatchStatus.Active;

        _safeTransferFrom(m.token, msg.sender, address(this), m.wagerAmount);

        emit MatchJoined(matchId, msg.sender);
    }

    /// @notice Admin/oracle resolves the match. 95% to winner, 5% rake to treasury.
    /// @param matchId The match to resolve.
    /// @param winner  Must be player1 or player2.
    function resolveMatch(
        bytes32 matchId,
        address winner
    ) external onlyOwner nonReentrant {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.Active, "WagerEscrow: not active");
        require(
            winner == m.player1 || winner == m.player2,
            "WagerEscrow: invalid winner"
        );

        m.status = MatchStatus.Resolved;

        uint256 totalPot = m.wagerAmount * 2;
        uint256 rake = (totalPot * rakePercent) / 100;
        uint256 payout = totalPot - rake;

        _safeTransfer(m.token, winner, payout);
        if (rake > 0) {
            _safeTransfer(m.token, treasury, rake);
        }

        emit MatchResolved(matchId, winner, payout, rake);
    }

    /// @notice Cancel a match and refund both players (only if still Created or Active).
    /// @dev Only owner can cancel. If Active, both get refunded. If Created, only player1.
    /// @param matchId The match to cancel.
    function cancelMatch(bytes32 matchId) external onlyOwner nonReentrant {
        Match storage m = matches[matchId];
        require(
            m.status == MatchStatus.Created || m.status == MatchStatus.Active,
            "WagerEscrow: cannot cancel"
        );

        MatchStatus previousStatus = m.status;
        m.status = MatchStatus.Cancelled;

        _safeTransfer(m.token, m.player1, m.wagerAmount);
        if (previousStatus == MatchStatus.Active) {
            _safeTransfer(m.token, m.player2, m.wagerAmount);
        }

        emit MatchCancelled(matchId);
    }

    /// @notice Player 1 reclaims their wager if no opponent joins within TIMEOUT_DURATION.
    /// @param matchId The match to reclaim.
    function claimTimeout(bytes32 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.Created, "WagerEscrow: not claimable");
        require(m.player1 == msg.sender, "WagerEscrow: not player1");
        require(
            block.timestamp >= m.createdAt + TIMEOUT_DURATION,
            "WagerEscrow: timeout not reached"
        );

        m.status = MatchStatus.Cancelled;

        _safeTransfer(m.token, m.player1, m.wagerAmount);

        emit TimeoutClaimed(matchId, msg.sender);
    }

    // ─── Admin Functions ─────────────────────────────────────────────────

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "WagerEscrow: zero address");
        address old = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }

    function setRakePercent(uint256 _rakePercent) external onlyOwner {
        require(_rakePercent <= 20, "WagerEscrow: rake too high");
        uint256 old = rakePercent;
        rakePercent = _rakePercent;
        emit RakePercentUpdated(old, _rakePercent);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "WagerEscrow: zero address");
        address old = owner;
        owner = newOwner;
        emit OwnershipTransferred(old, newOwner);
    }

    // ─── View Helpers ────────────────────────────────────────────────────

    function getMatch(bytes32 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    // ─── Internal Safe ERC-20 Helpers ────────────────────────────────────

    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd, from, to, amount) // transferFrom(address,address,uint256)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "WagerEscrow: transferFrom failed"
        );
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa9059cbb, to, amount) // transfer(address,uint256)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "WagerEscrow: transfer failed"
        );
    }
}
