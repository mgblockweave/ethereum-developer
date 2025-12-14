// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./NftPatriD.sol";

interface IERC3643 {
    function decimals() external view returns (uint8);
    function mint(address to, uint256 amount) external;
    function addToWhitelist(address account) external;
}

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
contract PatriDeFi is Ownable, Pausable {
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
    mapping(address => bool) private admins;
    address[] private adminList;
    mapping(address => uint256) public totalPieceValue; // total pieceValue (1e8 scale) minted for a wallet

    NftPatriD public goldNft;
    IERC3643 public patriGold;
    AggregatorV3Interface public priceFeed;

    uint256 private constant MG_PER_OUNCE = 31_103; // ~31.103 g in milligrams
    uint256 private constant MAX_BATCH = 100;
    uint256 private constant MAX_WEIGHT_MG = 1_000_000; // 1000 g
    uint256 private constant MAX_PIECE_VALUE = 1e24;   // generous upper bound

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

    event AdminAdded(address indexed account);
    event AdminRemoved(address indexed account);

    modifier onlyAdmin() {
        require(admins[msg.sender], "PatriDeFi: not admin");
        _;
    }

    /// @param patriDAddress Deployed NftPatriD (ERC1155) contract address
    /// @param priceFeedAddress Chainlink price feed for gold (per ounce)
    /// @param patriGoldAddress Deployed PatriGold (ERC3643) token address
    constructor(address patriDAddress, address priceFeedAddress, address patriGoldAddress) Ownable(msg.sender) {
        require(patriDAddress != address(0), "PatriDeFi: zero address");
        require(priceFeedAddress != address(0), "PatriDeFi: zero feed");
        require(patriGoldAddress != address(0), "PatriDeFi: zero PatriGold");
        goldNft = NftPatriD(patriDAddress);
        priceFeed = AggregatorV3Interface(priceFeedAddress);
        patriGold = IERC3643(patriGoldAddress);
        _addAdmin(msg.sender);
    }

    /// @notice Owner can add an admin (admins cannot add more admins)
    function addAdmin(address account) external onlyOwner {
        _addAdmin(account);
    }

    /// @notice Owner can remove an admin (owner itself cannot be removed)
    function removeAdmin(address account) external onlyOwner {
        require(account != owner(), "PatriDeFi: cannot remove owner");
        require(admins[account], "PatriDeFi: not admin");
        admins[account] = false;
        _removeFromList(account);
        emit AdminRemoved(account);
    }

    /// @notice Check if an address is admin
    function isAdmin(address account) external view returns (bool) {
        return admins[account];
    }

    /// @notice Returns the full list of admins (owner-only)
    function getAdmins() external view onlyOwner returns (address[] memory) {
        return adminList;
    }

    /// @notice Register or update a customer and mint a gold position NFT
    /// @dev Only admins can call this. Admins are managed by the owner.
    ///      Off-chain flow should be:
    ///        1. Save customer + Napoleons details into Supabase
    ///        2. Compute dataHash = keccak256(JSON(payload))
    ///        3. Compute supabaseId = keccak256(bytes(UUID)) or cast to bytes32
    ///        4. Call this function with wallet, supabaseId, dataHash and piece details
    /// @param wallet Customer on-chain wallet (will receive the NFTs)
    /// @param supabaseId Supabase customer identifier, as bytes32
    /// @param dataHash Hash of the off-chain payload stored in Supabase
    /// @param weightsMg Weight of each piece in milligrams
    /// @param qualities Quality of each piece (enum Quality)
    /// @return lastTokenId Last token minted
    function registerCustomerAndMintDetailed(
        address wallet,
        bytes32 supabaseId,
        bytes32 dataHash,
        uint256[] calldata weightsMg,
        Quality[] calldata qualities
    ) external onlyAdmin whenNotPaused returns (uint256 lastTokenId) {
        require(wallet != address(0), "PatriDeFi: invalid wallet");
        require(supabaseId != bytes32(0), "PatriDeFi: invalid Supabase id");
        require(dataHash != bytes32(0), "PatriDeFi: invalid data hash");
        require(weightsMg.length > 0, "PatriDeFi: no pieces");
        require(weightsMg.length == qualities.length, "PatriDeFi: arrays mismatch");
        require(weightsMg.length <= MAX_BATCH, "PatriDeFi: batch too large");

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

        uint256 added;
        (lastTokenId, added) = _mintPieces(wallet, supabaseId, goldPrice, weightsMg, qualities);
        if (added > 0) {
            totalPieceValue[wallet] += added;
            _mintPatriGold(wallet, added, 8); // gold price feed is 8 decimals
        }
    }

    /// @notice Update only the off-chain data hash (if Supabase row is changed)
    /// @param wallet Customer wallet address
    /// @param newDataHash New keccak256 hash of the off-chain payload
    function updateCustomerDataHash(
        address wallet,
        bytes32 newDataHash
    ) external onlyAdmin whenNotPaused {
        require(customers[wallet].exists, "PatriDeFi: customer not found");
        require(newDataHash != bytes32(0), "PatriDeFi: invalid data hash");
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

    function _addAdmin(address account) internal {
        require(account != address(0), "PatriDeFi: zero address");
        if (admins[account]) return;
        admins[account] = true;
        adminList.push(account);
        emit AdminAdded(account);
    }

    function _mintPieces(
        address wallet,
        bytes32 supabaseId,
        uint256 goldPrice,
        uint256[] calldata weightsMg,
        Quality[] calldata qualities
    ) internal returns (uint256 lastTokenId, uint256 totalAdded) {
        address recipient = owner(); // always custody NFTs on admin/owner
        for (uint256 i = 0; i < weightsMg.length; i++) {
            uint256 w = weightsMg[i];
            require(w > 0, "PatriDeFi: invalid weight");
            require(w <= MAX_WEIGHT_MG, "PatriDeFi: weight too large");
            require(uint256(uint8(qualities[i])) <= uint256(uint8(Quality.FDC)), "PatriDeFi: invalid quality");
            uint256 bps = _qualityToBps(qualities[i]);
            uint256 pieceValue = (goldPrice * w * bps) / (10000 * MG_PER_OUNCE);
            require(pieceValue > 0, "PatriDeFi: piece value too low");
            require(pieceValue <= MAX_PIECE_VALUE, "PatriDeFi: piece value too high");
            lastTokenId = goldNft.mintForCustomer(recipient, supabaseId, goldPrice, uint8(qualities[i]), pieceValue);
            totalAdded += pieceValue;
            emit CustomerPositionCreated(wallet, lastTokenId, 1);
        }
    }

    function _mintPatriGold(address to, uint256 pieceValueUsd, uint8 priceDecimals) internal {
        uint8 pgDec = patriGold.decimals();
        uint256 amount = (pieceValueUsd * (10 ** pgDec)) / (10 ** priceDecimals);
        if (amount == 0) return;
        patriGold.addToWhitelist(to); // authorise the client to hold PatriGold
        patriGold.mint(to, amount);
    }

    function _removeFromList(address account) internal {
        uint256 len = adminList.length;
        for (uint256 i = 0; i < len; i++) {
            if (adminList[i] == account) {
                adminList[i] = adminList[len - 1];
                adminList.pop();
                break;
            }
        }
    }

    /// @notice Emergency pause/unpause by owner
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
