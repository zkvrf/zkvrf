// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

interface IZKVRFCallback {
    function receiveRandomness(uint256 requestId, uint256 randomness) external;
}
