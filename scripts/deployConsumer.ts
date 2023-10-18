import { ethers, run } from 'hardhat'
import { ZKVRFGlobalConsumer__factory } from '../typechain-types'

const ZKVRF_ADDRESS = '0xFBF562a98aB8584178efDcFd09755FF9A1e7E3a2'

async function deploy() {
    const [deployer] = await ethers.getSigners()
    ///////////////////////////////////////////////////////////////////////////
    /// ZKVRFGlobalConsumer ///////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////

    const consumer = await new ZKVRFGlobalConsumer__factory(deployer)
        .deploy(ZKVRF_ADDRESS)
        .then((tx) => tx.waitForDeployment())

    console.log(`Deployed ZKVRFGlobalConsumer at ${await consumer.getAddress()}`)

    // Wait for etherscan to catch up
    await new Promise((resolve) => setTimeout(resolve, 60_000))
    await run('verify:verify', {
        address: await consumer.getAddress(),
        constructorArguments: [ZKVRF_ADDRESS],
    })
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
