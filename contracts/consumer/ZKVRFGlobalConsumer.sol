// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import {IZKVRFCallback} from "../interfaces/IZKVRFCallback.sol";
import {ZKVRF} from "../ZKVRF.sol";

/// @title ZKVRFGlobalConsumer
/// @notice Global singleton consumer that anyone can use
contract ZKVRFGlobalConsumer is IZKVRFCallback {
    /// @notice ZKVRF instance
    address public immutable zkvrf;
    /// @notice Fulfilled randomness requests; maps to 0 if unfulfilled or
    ///     invalid requestId
    mapping(uint256 requestId => uint256) public fulfilments;

    event ConsumerRandomnessRequested(
        uint256 indexed requestId,
        address indexed caller
    );
    event ConsumerRandomnessReceived(
        uint256 indexed requestId,
        uint256 randomness
    );

    constructor(address zkvrf_) {
        zkvrf = zkvrf_;
    }

    /// @notice Request randomness. durr
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
        emit ConsumerRandomnessRequested(requestId, msg.sender);
    }

    /// @notice Callback to receive the randomness fulfilment; the whole point
    ///     of this contract
    function receiveRandomness(uint256 requestId, uint256 randomness) external {
        require(fulfilments[requestId] == 0, "Already fulfilled");
        fulfilments[requestId] = randomness;
        emit ConsumerRandomnessReceived(requestId, randomness);
    }
}
