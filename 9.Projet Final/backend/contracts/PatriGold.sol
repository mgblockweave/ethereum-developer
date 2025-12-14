// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Simplified ERC3643-like token with whitelist gate on mint.
/// @dev Only the owner (PatriDeFi) can whitelist and mint. Transfer rules are not enforced here.
contract PatriGold is ERC20, Ownable {
    mapping(address => bool) public whitelisted;

    constructor() ERC20("PatriGold", "PGLD") Ownable(msg.sender) {}

    /// @notice Add an address to the whitelist so it can receive PatriGold.
    function addToWhitelist(address account) external onlyOwner {
        require(account != address(0), "PatriGold: zero address");
        whitelisted[account] = true;
    }

    /// @notice Mint tokens to a whitelisted address.
    /// @dev Keeps the interface minimal; real ERC3643 would integrate identity checks.
    function mint(address to, uint256 amount) external onlyOwner {
        require(whitelisted[to], "PatriGold: not whitelisted");
        require(amount > 0, "PatriGold: zero amount");
        _mint(to, amount);
    }
}
