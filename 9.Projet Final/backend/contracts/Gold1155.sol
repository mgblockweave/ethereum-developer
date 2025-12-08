// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Gold1155 - ERC1155 tokens representing gold positions
/// @notice This contract is responsible only for minting and tracking ERC1155 tokens.
///         PatriDeFi contract will call this one as a minter.
contract Gold1155 is ERC1155, Ownable {
    struct GoldToken {
        bytes32 supabaseId; // reference to the Supabase customer row (e.g. UUID hashed)
        uint256 amount;     // number of coins represented by this tokenId
    }

    mapping(uint256 => GoldToken) public goldTokens;

    address public minter;
    uint256 private _nextTokenId = 1;

    event MinterUpdated(address indexed newMinter);
    event GoldTokenMinted(
        uint256 indexed tokenId,
        address indexed to,
        bytes32 indexed supabaseId,
        uint256 amount
    );

    constructor(string memory uri_) ERC1155(uri_) Ownable(msg.sender) {}

    modifier onlyMinter() {
        require(msg.sender == minter, "Gold1155: caller is not the minter");
        _;
    }

    /// @notice Set the PatriDeFi contract as minter
    function setMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "Gold1155: zero address");
        minter = _minter;
        emit MinterUpdated(_minter);
    }

    /// @notice Mint a new gold position NFT for a customer
    /// @param to Wallet that will receive the ERC1155 tokens
    /// @param supabaseId Supabase customer identifier (bytes32)
    /// @param amount Number of coins represented by this tokenId
    /// @return tokenId Newly created token id
    function mintForCustomer(
        address to,
        bytes32 supabaseId,
        uint256 amount
    ) external onlyMinter returns (uint256 tokenId) {
        require(to != address(0), "Gold1155: invalid recipient");
        require(amount > 0, "Gold1155: amount must be > 0");
        require(supabaseId != bytes32(0), "Gold1155: invalid Supabase id");

        tokenId = _nextTokenId;
        _nextTokenId += 1;

        goldTokens[tokenId] = GoldToken({
            supabaseId: supabaseId,
            amount: amount
        });

        _mint(to, tokenId, amount, "");

        emit GoldTokenMinted(tokenId, to, supabaseId, amount);
    }

    /// @notice Expose next token id for off-chain tools
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
}
