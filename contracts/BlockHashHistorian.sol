// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

contract BlockHashHistorian {
    mapping(uint256 => bytes32) public historicalBlockHashes;

    error BlockHashNotAvailable(uint256 blockNumber);
    error InvalidBlock(uint256 blockNumber);
    error UnknownBlockHash(bytes32 blockHash);
    error InputLengthsMismatch();

    /// @notice Get a blockhash if it exists in the store or if it's recent,
    ///     otherwise revert
    /// @param blockNumber Block number
    /// @return block hash
    function getBlockHash(uint256 blockNumber) external view returns (bytes32) {
        if (blockNumber >= block.number - 256) {
            // Recent
            return blockhash(blockNumber);
        }
        bytes32 maybeBlockHash = historicalBlockHashes[blockNumber];
        if (maybeBlockHash == 0) {
            revert BlockHashNotAvailable(blockNumber);
        }
        return maybeBlockHash;
    }

    /// @notice Store recent blockhash i.e. blockNumber is not more than 256
    ///     blocks behind tip (will revert)
    /// @param blockNumber Block number
    function recordRecent(uint256 blockNumber) external {
        if (
            (blockNumber < block.number - 256) || (blockNumber >= block.number)
        ) {
            revert InvalidBlock(blockNumber);
        }
        historicalBlockHashes[blockNumber] = blockhash(blockNumber);
    }

    /// @notice Record a blockhash for block `n` by supplying the block header
    ///     RLP for block `n+1`. The block hash for block `n+1` must already be
    ///     known.
    /// @param blockNumbers Block numbers to record
    /// @param blockHeaderRLPs Serialised block header RLP of the next blocks
    function recordOld(
        uint256[] calldata blockNumbers,
        bytes[] calldata blockHeaderRLPs
    ) external {
        uint256 len = blockNumbers.length;
        if (len != blockHeaderRLPs.length) {
            revert InputLengthsMismatch();
        }

        for (uint256 i; i < len; ++i) {
            if (
                historicalBlockHashes[blockNumbers[i] + 1] !=
                keccak256(blockHeaderRLPs[i])
            ) {
                revert UnknownBlockHash(keccak256(blockHeaderRLPs[i]));
            }
            // `parentHash` in a serialised block header RLP is always located at
            // the slice [0x24:0x44]
            historicalBlockHashes[blockNumbers[i]] = bytes32(
                blockHeaderRLPs[i][0x24:0x44]
            );
        }
    }
}
