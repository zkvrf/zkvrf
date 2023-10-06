// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import {UltraVerifier} from "../circuits/contract/zkvrf_pkc_scheme/plonk_vk.sol";
import {BlockHashHistorian} from "./BlockHashHistorian.sol";

interface IZKVRFCallback {
    function receiveRandomness(uint256 requestId, bytes32 randomness) external;
}

/// @title ZKVRF
/// @notice A verifiable random function provider that uses a custom public-key
///     cryptography scheme with deterministic signatures, enabled by zkSNARKs.
contract ZKVRF {
    struct VRFRequest {
        uint256 targetBlockNumber;
        bytes32 randomness;
        address requester;
    }

    /// @notice SNARK verifier contract
    address public immutable verifier;
    /// @notice Block hash historian contract
    address public immutable blockHashHistorian;
    /// @notice Public key of this VRF contract
    bytes32 public immutable vrfPublicKey;
    /// @notice VRF requests
    mapping(uint256 requestId => VRFRequest) public requests;

    event RandomNumberRequested(
        uint256 indexed requestId,
        address indexed requester
    );
    event RandomnessFulfilled(
        uint256 indexed requestId,
        address indexed requester,
        bytes32 randomness
    );

    constructor(
        address verifier_,
        address blockHashHistorian_,
        bytes32 publicKey_
    ) {
        verifier = verifier_;
        blockHashHistorian = blockHashHistorian_;
        vrfPublicKey = publicKey_;
    }

    /// @notice Operator function to deliver verifiable random numbers. The
    ///     only entity that has the ability to call this function successfully
    ///     is the holder of the private key of this contract's `vrfPublicKey`
    /// @param requestId Request ID to fulfill
    /// @param publicInputs [public_key, msg_hash, sig]
    /// @param snarkProof SNARK proof of valid signature generation
    function deliver(
        uint256 requestId,
        bytes32[] calldata publicInputs,
        bytes calldata snarkProof
    ) external {
        // TODO(kevincharm): Fee payable
        // TODO(kevincharm): Assert publicKey, messageHash < field prime?
        require(publicInputs[0] == vrfPublicKey, "Public key mismatch");

        VRFRequest memory request = requests[requestId];
        require(request.targetBlockNumber != 0, "Request does not exist");
        require(request.randomness == 0, "Request already fulfilled");
        // NB: Target block *must* exist in the historian, otherwise it's up to
        // the operator to first post the block hash (with proof) to the
        // historian contract.
        bytes32 targetBlockHash = BlockHashHistorian(blockHashHistorian)
            .getBlockHash(request.targetBlockNumber);
        require(
            publicInputs[1] ==
                sha256(
                    abi.encodePacked(
                        targetBlockHash,
                        request.requester,
                        requestId
                    )
                ),
            "Message digest mismatch"
        );
        require(
            UltraVerifier(verifier).verify(snarkProof, publicInputs),
            "Invalid SNARK proof"
        );
        // Signature is the output of a Poseidon hash; a field that can be
        // represented in 254 bits. So we expand it to 256 bits by using
        // sha256 as a PRF.
        bytes32 randomness = sha256(abi.encodePacked(publicInputs[2]));
        requests[requestId].randomness = randomness;

        // Callback with randomness
        // TODO(kevincharm): Use raw call here (ignore revert), limit gas
        IZKVRFCallback(request.requester).receiveRandomness(
            requestId,
            randomness
        );

        emit RandomnessFulfilled(requestId, request.requester, randomness);
    }
}
