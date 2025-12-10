// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal Chainlink-style price feed for local/testing
contract MockGoldPriceFeed {
    uint8 public constant decimals = 8;
    int256 private _answer;
    uint80 private _roundId;
    uint256 private _updatedAt;

    constructor(int256 initialAnswer) {
        _answer = initialAnswer;
        _roundId = 1;
        _updatedAt = block.timestamp;
    }

    function updateAnswer(int256 newAnswer) external {
        _answer = newAnswer;
        _roundId += 1;
        _updatedAt = block.timestamp;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_roundId, _answer, _updatedAt, _updatedAt, _roundId);
    }
}
