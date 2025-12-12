// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @title NftPatriD - ERC1155 tokens representing gold positions
/// @notice This contract is responsible only for minting and tracking ERC1155 tokens.
///         PatriDeFi contract will call this one as a minter.
contract NftPatriD is ERC1155, Ownable {
    using Strings for uint256;

    struct GoldToken {
        bytes32 supabaseId; // reference to the Supabase customer row (e.g. UUID hashed)
        uint256 amount;     // number of coins represented by this tokenId (per piece -> always 1)
        uint256 goldPrice;  // price of gold (per ounce) at mint time, scaled as returned by Chainlink
        uint8 quality;      // qualité (enum côté PatriDeFi)
        uint256 pieceValue; // valeur calculée de la pièce (avec qualité), même échelle que goldPrice
    }

    mapping(uint256 => GoldToken) public goldTokens;

    address public minter;
    uint256 private _nextTokenId = 1;
    string private _baseURI;

    event MinterUpdated(address indexed newMinter);
    event GoldTokenMinted(
        uint256 indexed tokenId,
        address indexed to,
        bytes32 indexed supabaseId,
        uint256 amount,
        uint256 goldPrice,
        uint8 quality,
        uint256 pieceValue
    );

    constructor(string memory baseURI_) ERC1155("") Ownable(msg.sender) {
        _baseURI = baseURI_;
    }

    function setBaseURI(string memory newBaseURI) external onlyOwner {
        _baseURI = newBaseURI;
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        require(tokenId > 0 && tokenId < _nextTokenId, "NftPatriD: URI query for nonexistent token");
        return string(abi.encodePacked(_baseURI, tokenId.toString(), ".json"));
    }

    modifier onlyMinter() {
        require(msg.sender == minter, "NftPatriD: caller is not the minter");
        _;
    }

    /// @notice Set the PatriDeFi contract as minter
    function setMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "NftPatriD: zero address");
        minter = _minter;
        emit MinterUpdated(_minter);
    }

    /// @notice Mint a new gold position NFT for a customer (one piece per token)
    /// @param to Wallet that will receive the ERC1155 token
    /// @param supabaseId Supabase customer identifier (bytes32)
    /// @param goldPrice Gold price (per ounce) at mint time, scaled according to Chainlink feed decimals
    /// @param quality Qualité de la pièce (enum côté PatriDeFi)
    /// @param pieceValue Valeur calculée de la pièce (avec qualité)
    /// @return tokenId Newly created token id
    function mintForCustomer(
        address to,
        bytes32 supabaseId,
        uint256 goldPrice,
        uint8 quality,
        uint256 pieceValue
    ) external onlyMinter returns (uint256 tokenId) {
        require(to != address(0), "NftPatriD: invalid recipient");
        require(supabaseId != bytes32(0), "NftPatriD: invalid Supabase id");
        require(goldPrice > 0, "NftPatriD: invalid gold price");
        require(pieceValue > 0, "NftPatriD: invalid piece value");

        tokenId = _nextTokenId;
        _nextTokenId += 1;

        goldTokens[tokenId] = GoldToken({
            supabaseId: supabaseId,
            amount: 1,
            goldPrice: goldPrice,
            quality: quality,
            pieceValue: pieceValue
        });

        _mint(to, tokenId, 1, "");

        emit GoldTokenMinted(tokenId, to, supabaseId, 1, goldPrice, quality, pieceValue);
    }

    /// @notice Expose next token id for off-chain tools
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
}
