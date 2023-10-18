import { ethers } from 'hardhat'
import {
    BlockHashHistorian__factory,
    UltraVerifier__factory,
    ZKVRFGlobalConsumer__factory,
    ZKVRF__factory,
} from '../typechain-types'
import { EXAMPLE_OPERATOR_PRIV_KEY, EXAMPLE_OPERATOR_PUB_KEY } from './constants'
import { poseidon } from '../test/poseidon'
import { generateWitnessAndProof } from '../test/generateWitnessAndProof'

const ZKVRF_ADDRESS = '0xFBF562a98aB8584178efDcFd09755FF9A1e7E3a2'
const ZKVRF_GLOBAL_CONSUMER = '0xE537f0394C84bbA5536400aD0f2Fc9Bb7A46791d'

async function deploy() {
    const [deployer] = await ethers.getSigners()

    const consumer = await ZKVRFGlobalConsumer__factory.connect(
        ZKVRF_GLOBAL_CONSUMER,
        deployer,
    ).waitForDeployment()

    // Do example request & response
    const requestRandomnessTx = await consumer
        .requestRandomness(EXAMPLE_OPERATOR_PUB_KEY, 1, 500_000)
        .then((tx) => tx.wait(5))
    const randomnessRequestedEvent = requestRandomnessTx!.logs.find(
        (log) =>
            ZKVRF__factory.createInterface().parseLog(log as any)?.name === 'RandomnessRequested',
    )
    const [
        _requestId,
        _operatorPublicKey,
        _requester,
        _minBlockConfirmations,
        _callbackGasLimit,
        _nonce,
    ] = ZKVRF__factory.createInterface().decodeEventLog(
        'RandomnessRequested',
        randomnessRequestedEvent!.data,
        randomnessRequestedEvent!.topics,
    )

    console.log(
        `RandomnessRequested(${_requestId}, ${_operatorPublicKey}, ${_requester}, ${_minBlockConfirmations}, ${_callbackGasLimit}, ${_nonce})`,
    )

    // Fulfill with ZKP
    const operatorPublicKey = EXAMPLE_OPERATOR_PUB_KEY
    const operatorPrivateKey = EXAMPLE_OPERATOR_PRIV_KEY
    const zkvrf = await ZKVRF__factory.connect(ZKVRF_ADDRESS, deployer).waitForDeployment()
    const onchainBlockhash = await BlockHashHistorian__factory.connect(
        await zkvrf.blockHashHistorian(),
        deployer,
    ).getBlockHash(requestRandomnessTx!.blockNumber)
    console.log(`Onchain blockhash: ${onchainBlockhash}`)

    const messageHash = await zkvrf.hashSeedToField(
        _requester,
        onchainBlockhash, // NB: Scroll blockhash is BROKEN // requestRandomnessTx!.blockHash
        _nonce,
    )
    console.log(`Message hash: ${messageHash}`)

    // hash_2([private_key, hash_3([private_key, message_hash, 0])]),
    // hash_2([private_key, hash_3([private_key, message_hash, 1])])
    const signature = [
        await poseidon([operatorPrivateKey, await poseidon([operatorPrivateKey, messageHash, 0])]),
        await poseidon([operatorPrivateKey, await poseidon([operatorPrivateKey, messageHash, 1])]),
    ] as [string, string]
    console.log(`Signature: ${signature}`)

    const proofStartedAt = performance.now()
    const { proof } = await generateWitnessAndProof({
        private_key: operatorPrivateKey,
        public_key: operatorPublicKey,
        message_hash: messageHash,
    })
    const proofCompletedAt = performance.now()
    console.log(`Proof took: ${proofCompletedAt - proofStartedAt} ms`)

    // Try static - this is a sanity check only
    const verifier = await UltraVerifier__factory.connect(
        await zkvrf.verifier(),
        deployer,
    ).waitForDeployment()
    const isValid = await verifier.verify(
        proof,
        [operatorPublicKey, messageHash, signature[0], signature[1]],
        {
            gasLimit: 10_000_000,
        },
    )
    console.log(`Verifier answer: ${isValid}`)

    // Fulfill randomness with ZKP
    const tx = await zkvrf
        .fulfillRandomness(
            _requestId,
            {
                operatorPublicKey,
                blockNumber: requestRandomnessTx!.blockNumber,
                minBlockConfirmations: _minBlockConfirmations,
                callbackGasLimit: _callbackGasLimit,
                requester: _requester,
                nonce: _nonce,
            },
            signature,
            proof,
        )
        .then((tx) => tx.wait(1))
    console.log(`Fulfill tx: ${tx?.hash}`)
}

deploy()
    .then(() => {
        console.log('Done')
        process.exit(0)
    })
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
