// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import {IZKVRFCallback} from "../interfaces/IZKVRFCallback.sol";
import {ZKVRF} from "../ZKVRF.sol";

contract ZKVRFConsumer is IZKVRFCallback {
    address public immutable zkvrf;

    event RandomnessReceived(uint256 indexed requestId, uint256 randomness);

    constructor(address zkvrf_) {
        zkvrf = zkvrf_;
    }

    function requestRandomness(
        bytes32 operatorPublicKey,
        uint16 minBlockConfirmations,
        uint32 callbackGasLimit
    ) external returns (uint256 requestId) {
        requestId = ZKVRF(zkvrf).requestRandomness(
            operatorPublicKey,
            minBlockConfirmations,
            callbackGasLimit
        );
    }

    function receiveRandomness(uint256 requestId, uint256 randomness) external {
        emit RandomnessReceived(requestId, randomness);
    }
}
