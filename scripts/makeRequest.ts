import { ethers } from 'hardhat'
import { ZKVRFGlobalConsumer__factory, ZKVRF__factory } from '../typechain-types'
import { EXAMPLE_OPERATOR_PRIV_KEY, EXAMPLE_OPERATOR_PUB_KEY } from './constants'
import { getPoseidon } from '../test/poseidon'
import { generateWitnessAndProof } from '../test/generateWitnessAndProof'

const ZKVRF_ADDRESS = '0xFBF562a98aB8584178efDcFd09755FF9A1e7E3a2'
const ZKVRF_GLOBAL_CONSUMER = '0xdA7b125147Eb16c27Ce215b15b6F4077B3411deA'

async function deploy() {
    const [deployer] = await ethers.getSigners()

    const consumer = await ZKVRFGlobalConsumer__factory.connect(
        ZKVRF_GLOBAL_CONSUMER,
        deployer,
    ).waitForDeployment()

    // Do example request & response
    const requestRandomnessTx = await consumer
        .requestRandomness(EXAMPLE_OPERATOR_PUB_KEY, 1, 500_000)
        .then((tx) => tx.wait(2))
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

    // Fulfill with ZKP
    const operatorPublicKey = EXAMPLE_OPERATOR_PUB_KEY
    const operatorPrivateKey = EXAMPLE_OPERATOR_PRIV_KEY
    const zkvrf = await ZKVRF__factory.connect(ZKVRF_ADDRESS, deployer).waitForDeployment()
    const messageHash = await zkvrf.hashSeedToField(
        _requester,
        requestRandomnessTx!.blockHash,
        _nonce,
    )
    const poseidon = await getPoseidon()
    // hash_2([private_key, hash_3([private_key, message_hash, 0])]),
    // hash_2([private_key, hash_3([private_key, message_hash, 1])])
    const signature = [
        '0x' +
            poseidon.F.toString(
                poseidon([operatorPrivateKey, poseidon([operatorPrivateKey, messageHash, 0])]),
                16,
            ).padStart(64, '0'),
        '0x' +
            poseidon.F.toString(
                poseidon([operatorPrivateKey, poseidon([operatorPrivateKey, messageHash, 1])]),
                16,
            ).padStart(64, '0'),
    ] as [string, string]

    const proofStartedAt = performance.now()
    const { proof } = await generateWitnessAndProof({
        private_key: operatorPrivateKey,
        public_key: operatorPublicKey,
        message_hash: messageHash,
    })
    const proofCompletedAt = performance.now()

    console.log(`Proof took: ${proofCompletedAt - proofStartedAt} ms`)
    // Fulfill randomness with ZKP
    await zkvrf
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
            {
                gasLimit: 1_000_000,
            },
        )
        .then((tx) => tx.wait(1))
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
