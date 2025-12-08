// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Gold1155.sol";

/// @title PatriDeFi - Links off-chain Supabase records with on-chain ERC1155 gold NFTs
/// @notice Frontend/backend must first write data into Supabase, then call this contract
///         with the Supabase customer identifier and a hash of the full payload.
contract PatriDeFi is Ownable {
    struct Customer {
        bytes32 supabaseId; // Supabase row identifier (e.g. UUID hashed to bytes32)
        bytes32 dataHash;   // keccak256 hash of the full off-chain JSON payload
        bool exists;
    }

    mapping(address => Customer) public customers;

    Gold1155 public goldNft;

    event CustomerRegistered(
        address indexed wallet,
        bytes32 indexed supabaseId,
        bytes32 dataHash
    );

    event CustomerUpdated(
        address indexed wallet,
        bytes32 indexed supabaseId,
        bytes32 dataHash
    );

    event CustomerPositionCreated(
        address indexed wallet,
        uint256 indexed tokenId,
        uint256 amount
    );

    /// @param gold1155Address Deployed Gold1155 contract address
    constructor(address gold1155Address) Ownable(msg.sender) {
        require(gold1155Address != address(0), "PatriDeFi: zero address");
        goldNft = Gold1155(gold1155Address);
    }

    /// @notice Register or update a customer and mint a gold position NFT
    /// @dev Only the owner (admin) can call this.
    ///      Off-chain flow should be:
    ///        1. Save customer + Napoleons details into Supabase
    ///        2. Compute dataHash = keccak256(JSON(payload))
    ///        3. Compute supabaseId = keccak256(bytes(UUID)) or cast to bytes32
    ///        4. Call this function with wallet, supabaseId, dataHash and amount
    /// @param wallet Customer on-chain wallet (will receive the NFT)
    /// @param supabaseId Supabase customer identifier, as bytes32
    /// @param dataHash Hash of the off-chain payload stored in Supabase
    /// @param amount Total number of coins (Napoléons) represented by this NFT position
    /// @return tokenId Newly minted ERC1155 token id
    function registerCustomerAndMint(
        address wallet,
        bytes32 supabaseId,
        bytes32 dataHash,
        uint256 amount
    ) external onlyOwner returns (uint256 tokenId) {
        require(wallet != address(0), "PatriDeFi: invalid wallet");
        require(supabaseId != bytes32(0), "PatriDeFi: invalid Supabase id");
        require(amount > 0, "PatriDeFi: amount must be > 0");

        bool alreadyExists = customers[wallet].exists;

        customers[wallet] = Customer({
            supabaseId: supabaseId,
            dataHash: dataHash,
            exists: true
        });

        if (alreadyExists) {
            emit CustomerUpdated(wallet, supabaseId, dataHash);
        } else {
            emit CustomerRegistered(wallet, supabaseId, dataHash);
        }

        // Mint ERC1155 position through the NFT contract
        tokenId = goldNft.mintForCustomer(wallet, supabaseId, amount);

        emit CustomerPositionCreated(wallet, tokenId, amount);
    }

    /// @notice Update only the off-chain data hash (if Supabase row is changed)
    /// @param wallet Customer wallet address
    /// @param newDataHash New keccak256 hash of the off-chain payload
    function updateCustomerDataHash(
        address wallet,
        bytes32 newDataHash
    ) external onlyOwner {
        require(customers[wallet].exists, "PatriDeFi: customer not found");
        customers[wallet].dataHash = newDataHash;
        emit CustomerUpdated(wallet, customers[wallet].supabaseId, newDataHash);
    }

    /// @notice Simple helper to check if a wallet is registered
    function isCustomer(address wallet) external view returns (bool) {
        return customers[wallet].exists;
    }
}
