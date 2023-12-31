import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import {
    BlockHashHistorian,
    BlockHashHistorian__factory,
    UltraVerifier,
    UltraVerifier__factory,
    ZKVRF__factory,
    ZKVRFGlobalConsumer__factory,
} from '../typechain-types'
import { generateWitnessAndProof } from './generateWitnessAndProof'
import { poseidon } from './poseidon'

const mockZkvrfSig = {
    privateKey: '0x01c8bdf6686d4c8ba09db5f15ffee3c470a5e0ff54d6fbac3a548f9a666977',
    publicKey: '0x15d76b9641dc1e52de6f9530a4161f077c348b1329efaeb0e052f13b5bf1ce49',
    messageHash: '0x003f46cee85de01c829c15a96765a024b48687825bca602b2124485dad9612a4',
    signature: [
        '0x1936f2209a2b048aa72fac77d56b9627a870449cf357de9744a54dafa0be8202',
        '0x25f0e32ce893cadb55ac7483237e554b03659b4498afe9a9d977e094ab1d68d1',
    ],
}

describe('ZKVRF', async () => {
    let deployer: SignerWithAddress
    let bob: SignerWithAddress
    let alice: SignerWithAddress
    let verifier: UltraVerifier
    let blockHashHistorian: BlockHashHistorian
    beforeEach(async () => {
        ;[deployer, bob, alice] = await ethers.getSigners()
        verifier = await new UltraVerifier__factory(deployer).deploy()
        blockHashHistorian = await new BlockHashHistorian__factory(deployer).deploy()
    })

    it('should run happy path', async () => {
        const zkvrf = await new ZKVRF__factory(deployer).deploy(
            await verifier.getAddress(),
            await blockHashHistorian.getAddress(),
        )
        // Deploy "mock" VRF consumer
        const consumer = await new ZKVRFGlobalConsumer__factory(bob).deploy(
            await zkvrf.getAddress(),
        )

        // Register operator
        await zkvrf.registerOperator(mockZkvrfSig.publicKey)
        expect(await zkvrf.isOperator(mockZkvrfSig.publicKey))

        // Request (via mock consumer)
        const operatorPublicKey = mockZkvrfSig.publicKey
        const minBlockConfirmations = 1
        const callbackGasLimit = 500_000
        const requestId = await consumer
            .connect(bob)
            .requestRandomness.staticCall(
                operatorPublicKey,
                minBlockConfirmations,
                callbackGasLimit,
            )
        const requestRandomnessTx = await consumer
            .connect(bob)
            .requestRandomness(operatorPublicKey, minBlockConfirmations, callbackGasLimit)
            .then((tx) => tx.wait(1))

        // Ensure that the event is fired correctly
        const randomnessRequestedEvent = requestRandomnessTx!.logs.find(
            (log) =>
                ZKVRF__factory.createInterface().parseLog(log as any)?.name ===
                'RandomnessRequested',
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
        expect(_requestId).to.eq(requestId)
        expect(_operatorPublicKey).to.eq(operatorPublicKey)
        expect(_requester).to.eq(await consumer.getAddress())
        expect(_minBlockConfirmations).to.eq(minBlockConfirmations)
        expect(_callbackGasLimit).to.eq(callbackGasLimit)
        expect(_nonce).to.eq(0)

        // Check request commitment
        const requestCommitment = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['bytes32', 'uint256', 'uint16', 'uint32', 'address', 'uint256'],
                [
                    _operatorPublicKey,
                    requestRandomnessTx!.blockNumber,
                    _minBlockConfirmations,
                    _callbackGasLimit,
                    _requester,
                    _nonce,
                ],
            ),
        )
        expect(await zkvrf.requests(requestId)).to.eq(requestCommitment)

        // --- zk shit ---
        const operatorPrivateKey = mockZkvrfSig.privateKey
        const messageHash = await zkvrf.hashSeedToField(
            _requester,
            requestRandomnessTx!.blockHash,
            _nonce,
        )

        // hash_2([private_key, hash_3([private_key, message_hash, 0])]),
        // hash_2([private_key, hash_3([private_key, message_hash, 1])])
        const signature = [
            await poseidon([
                operatorPrivateKey,
                await poseidon([operatorPrivateKey, messageHash, 0]),
            ]),
            await poseidon([
                operatorPrivateKey,
                await poseidon([operatorPrivateKey, messageHash, 1]),
            ]),
        ] as [string, string]

        const proofStartedAt = performance.now()
        const { proof } = await generateWitnessAndProof({
            private_key: operatorPrivateKey,
            public_key: operatorPublicKey,
            message_hash: messageHash,
        })
        const proofCompletedAt = performance.now()
        console.log(`Proof took: ${proofCompletedAt - proofStartedAt} ms`)

        // await verifier.verify(proof, [operatorPublicKey, messageHash, signature[0], signature[1]], {
        //     gasLimit: 10_000_000,
        // })

        // Fulfill randomness with ZKP
        await zkvrf.fulfillRandomness(
            requestId,
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
                gasLimit: 10_000_000,
            },
        )
    })

    it('should return paginated result of operators', async () => {
        const zkvrf = await new ZKVRF__factory(deployer).deploy(
            await verifier.getAddress(),
            await blockHashHistorian.getAddress(),
        )
        const operatorPubKeys = Array(10)
            .fill(0)
            .map((_) => ethers.hexlify(ethers.randomBytes(32)))
        for (const pk of operatorPubKeys) {
            await zkvrf.registerOperator(pk)
        }
        const pubKeysReversed = operatorPubKeys.slice().reverse()
        expect(await zkvrf.getOperatorsCount()).to.eq(10)
        expect(await zkvrf.getOperators(ethers.ZeroHash, 1)).to.deep.eq(pubKeysReversed.slice(0, 1))
        expect(await zkvrf.getOperators(ethers.ZeroHash, 5)).to.deep.eq(pubKeysReversed.slice(0, 5))
        expect(await zkvrf.getOperators(pubKeysReversed[1], 1)).to.deep.eq(
            pubKeysReversed.slice(2, 3),
        )
        expect(await zkvrf.getOperators(pubKeysReversed[4], 5)).to.deep.eq(
            pubKeysReversed.slice(5, 10),
        )
        expect(await zkvrf.getOperators(pubKeysReversed[4], 10)).to.deep.eq(
            pubKeysReversed.slice(5),
        )
    })
})
