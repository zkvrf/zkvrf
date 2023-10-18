import { ethers, run } from 'hardhat'
import {
    BlockHashHistorian__factory,
    UltraVerifier__factory,
    ZKVRF__factory,
} from '../typechain-types'
import { EXAMPLE_OPERATOR_PUB_KEY } from './constants'

async function deploy() {
    const [deployer] = await ethers.getSigners()
    const verifier = await new UltraVerifier__factory(deployer)
        .deploy()
        .then((tx) => tx.waitForDeployment())
    const blockHashHistorian = await new BlockHashHistorian__factory(deployer)
        .deploy()
        .then((tx) => tx.waitForDeployment())

    const zkvrfArgs = [await verifier.getAddress(), await blockHashHistorian.getAddress()] as const
    const zkvrf = await new ZKVRF__factory(deployer)
        .deploy(...zkvrfArgs)
        .then((tx) => tx.waitForDeployment())
    console.log(`Deployed ZKVRF at: ${await zkvrf.getAddress()}`)

    // Register example operator
    await zkvrf.registerOperator(EXAMPLE_OPERATOR_PUB_KEY).then((tx) => tx.wait(1))

    // Wait for etherscan to catch up
    await new Promise((resolve) => setTimeout(resolve, 60_000))
    await run('verify:verify', {
        address: await verifier.getAddress(),
        constructorArguments: [],
    })
    await run('verify:verify', {
        address: await blockHashHistorian.getAddress(),
        constructorArguments: [],
    })
    await run('verify:verify', {
        address: await zkvrf.getAddress(),
        constructorArguments: zkvrfArgs,
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
