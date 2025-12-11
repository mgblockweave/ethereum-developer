// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Gold1155.sol";

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

/// @title PatriDeFi - Links off-chain Supabase records with on-chain ERC1155 gold NFTs
/// @notice Frontend/backend must first write data into Supabase, then call this contract
///         with the Supabase customer identifier and a hash of the full payload.
contract PatriDeFi is Ownable {
    enum Quality {
        TB,   // Très Bon
        TTB,  // Très Très Beau
        SUP,  // Superbe
        SPL,  // Splendide
        FDC   // Fleur de Coin
    }

    struct Customer {
        bytes32 supabaseId; // Supabase row identifier (e.g. UUID hashed to bytes32)
        bytes32 dataHash;   // keccak256 hash of the full off-chain JSON payload
        bool exists;
    }

    mapping(address => Customer) public customers;

    Gold1155 public goldNft;
    AggregatorV3Interface public priceFeed;

    uint256 private constant MG_PER_OUNCE = 31_103; // ~31.103 g en milligrammes

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
    /// @param priceFeedAddress Chainlink price feed for gold (per ounce)
    constructor(address gold1155Address, address priceFeedAddress) Ownable(msg.sender) {
        require(gold1155Address != address(0), "PatriDeFi: zero address");
        require(priceFeedAddress != address(0), "PatriDeFi: zero feed");
        goldNft = Gold1155(gold1155Address);
        priceFeed = AggregatorV3Interface(priceFeedAddress);
    }

    /// @notice Register or update a customer and mint a gold position NFT
    /// @dev Only the owner (admin) can call this.
    ///      Off-chain flow should be:
    ///        1. Save customer + Napoleons details into Supabase
    ///        2. Compute dataHash = keccak256(JSON(payload))
    ///        3. Compute supabaseId = keccak256(bytes(UUID)) or cast to bytes32
    ///        4. Call this function with wallet, supabaseId, dataHash and détails des pièces
    /// @param wallet Customer on-chain wallet (will receive the NFTs)
    /// @param supabaseId Supabase customer identifier, as bytes32
    /// @param dataHash Hash of the off-chain payload stored in Supabase
    /// @param weightsMg Poids de chaque pièce en milligrammes
    /// @param qualities Qualité de chaque pièce (enum Quality)
    /// @return lastTokenId Dernier token minté
    function registerCustomerAndMintDetailed(
        address wallet,
        bytes32 supabaseId,
        bytes32 dataHash,
        uint256[] calldata weightsMg,
        Quality[] calldata qualities
    ) external onlyOwner returns (uint256 lastTokenId) {
        require(wallet != address(0), "PatriDeFi: invalid wallet");
        require(supabaseId != bytes32(0), "PatriDeFi: invalid Supabase id");
        require(weightsMg.length > 0, "PatriDeFi: no pieces");
        require(weightsMg.length == qualities.length, "PatriDeFi: arrays mismatch");

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

        // Fetch gold price (per ounce) from Chainlink
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "PatriDeFi: invalid gold price");
        uint256 goldPrice = uint256(price);

        // Mint one ERC1155 per piece
        for (uint256 i = 0; i < weightsMg.length; i++) {
            uint256 w = weightsMg[i];
            require(w > 0, "PatriDeFi: invalid weight");
            uint256 bps = _qualityToBps(qualities[i]);
            uint256 pieceValue = (goldPrice * w * bps) / (10000 * MG_PER_OUNCE);
            require(pieceValue > 0, "PatriDeFi: piece value too low");
            lastTokenId = goldNft.mintForCustomer(wallet, supabaseId, goldPrice, uint8(qualities[i]), pieceValue);
            emit CustomerPositionCreated(wallet, lastTokenId, 1);
        }
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

    function _qualityToBps(Quality q) internal pure returns (uint256) {
        if (q == Quality.TB) return 8000;  // 80%
        if (q == Quality.TTB) return 9000; // 90%
        if (q == Quality.SUP) return 9500; // 95%
        if (q == Quality.SPL) return 9750; // 97.5%
        return 10000; // FDC = 100%
    }
}
