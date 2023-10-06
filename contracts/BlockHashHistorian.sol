// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

interface BlockHashHistorian {
    /// @notice Get a blockhash if it exists in the store or if it's recent,
    ///     otherwise revert
    /// @param blockNumber Block number
    /// @return block hash
    function getBlockHash(uint256 blockNumber) external returns (bytes32);

    /// @notice Store recent blockhash i.e. blockNumber is not more than 256
    ///     blocks behind tip (will revert)
    /// @param blockNumber Block number
    function recordRecent(uint256 blockNumber) external;

    // TODO: Other historical store functions
}
