// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import {Sets} from "./lib/Sets.sol";
import {UltraVerifier} from "../circuits/contract/zkvrf_pkc_scheme/plonk_vk.sol";
import {BlockHashHistorian} from "./BlockHashHistorian.sol";

interface IZKVRFCallback {
    function receiveRandomness(uint256 requestId, uint256 randomness) external;
}

/// @title ZKVRF
/// @notice A verifiable random function provider that uses a custom public-key
///     cryptography scheme with deterministic signatures, enabled by zkSNARKs.
contract ZKVRF {
    using Sets for Sets.Set;

    struct VRFRequest {
        bytes32 operatorPublicKey;
        uint256 blockNumber;
        uint16 minBlockConfirmations;
        uint32 callbackGasLimit;
        // Seed components:
        address requester;
        uint256 nonce;
    }

    /// @notice SNARK verifier contract
    address public immutable verifier;
    /// @notice Where we get da hashes from
    address public immutable blockHashHistorian;
    /// @notice Operator public key set
    Sets.Set private operators;
    /// @notice Request id
    uint256 public nextRequestId;
    /// @notice VRF request commitments
    mapping(uint256 requestId => bytes32) public requests;
    /// @notice Fulfilled randomnesses
    mapping(uint256 requestId => uint256) public randomness;
    /// @notice Nonces used as part of randomness seeds
    mapping(address requester => uint256) public requestNonces;

    event RandomNumberRequested(
        uint256 indexed requestId,
        bytes32 indexed operatorPublicKey,
        address indexed requester,
        uint16 minBlockConfirmations,
        uint32 callbackGasLimit,
        uint256 nonce
    );
    event RandomnessFulfilled(
        uint256 indexed requestId,
        bytes32 indexed operatorPublicKey,
        address indexed requester,
        uint256 nonce,
        uint256 randomness
    );

    constructor(address verifier_, address blockHashHistorian_) {
        verifier = verifier_;
        blockHashHistorian = blockHashHistorian_;
        operators.init();
    }

    function registerOperator(bytes32 publicKey) external {
        operators.add(publicKey);
    }

    function requestRandomness(
        bytes32 operatorPublicKey,
        uint16 minBlockConfirmations,
        uint32 callbackGasLimit
    ) external returns (uint256 requestId) {
        require(operators.has(operatorPublicKey), "Unknown operator");

        requestId = nextRequestId++;
        uint256 nonce = requestNonces[msg.sender]++;

        requests[requestId] = keccak256(
            abi.encode(
                operatorPublicKey,
                block.number,
                minBlockConfirmations,
                callbackGasLimit,
                msg.sender,
                nonce
            )
        );

        emit RandomNumberRequested(
            requestId,
            operatorPublicKey,
            msg.sender,
            minBlockConfirmations,
            callbackGasLimit,
            nonce
        );
    }

    /// @notice Operator function to deliver verifiable random numbers. The
    ///     only entity that has the ability to call this function successfully
    ///     is the holder of the private key of this contract's `vrfPublicKey`
    /// @param requestId Request ID to fulfill
    /// @param snarkProof SNARK proof of valid signature generation
    function fulfillRandomness(
        uint256 requestId,
        VRFRequest calldata request,
        bytes32[2] calldata signature,
        bytes calldata snarkProof
    ) external {
        require(randomness[requestId] == 0, "Already fulfilled");
        require(
            block.number >= request.blockNumber + request.minBlockConfirmations,
            "Saba7 al 5er! Too early!"
        );
        // TODO(kevincharm): Fee payable
        // TODO(kevincharm): Assert publicKey, messageHash < field prime?

        bytes32 requestCommitment = keccak256(
            abi.encode(
                request.operatorPublicKey,
                request.blockNumber,
                request.minBlockConfirmations,
                request.callbackGasLimit,
                request.requester,
                request.nonce
            )
        );
        require(
            requests[requestId] == requestCommitment,
            "Invalid request commitment"
        );

        // Build SNARK public inputs
        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = request.operatorPublicKey;
        // Seed <- keccak(requester, blockhash, nonce)
        publicInputs[1] = keccak256(
            abi.encodePacked(
                request.requester,
                BlockHashHistorian(blockHashHistorian).getBlockHash(
                    request.blockNumber
                ),
                request.nonce
            )
        );
        publicInputs[2] = signature[0];
        publicInputs[3] = signature[1];
        require(
            UltraVerifier(verifier).verify(snarkProof, publicInputs),
            "Invalid SNARK proof"
        );
        // Signature is the output of 2x Poseidon hashes; a field that can be
        // represented in 254 bits.
        // We take 128 bits from each hash to build a 256-bit entropy
        // source, then feed it into keccak256.
        uint256 entropy = (uint256(signature[0]) << 128) |
            (uint256(signature[1]) & (type(uint128).max - 1));
        uint256 derivedRandomness = uint256(keccak256(abi.encode(entropy)));
        randomness[requestId] = derivedRandomness;

        // Callback with randomness
        // TODO(kevincharm): Use raw call here (ignore revert), limit gas
        IZKVRFCallback(request.requester).receiveRandomness{
            gas: request.callbackGasLimit
        }(requestId, derivedRandomness);

        emit RandomnessFulfilled(
            requestId,
            request.operatorPublicKey,
            request.requester,
            request.nonce,
            derivedRandomness
        );
    }
}
