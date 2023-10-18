import assert from 'assert'
import circuit from '../circuits/target/zkvrf_pkc_scheme.json'

async function initNoir() {
    const { Noir } = await import('@noir-lang/noir_js')
    const { BarretenbergBackend } = await import('@noir-lang/backend_barretenberg')
    const backend = new BarretenbergBackend(circuit as any)
    const noir = new Noir(circuit as any, backend)
    return {
        backend,
        noir,
    }
}

export async function generateWitnessAndProof(inputs: any) {
    const { noir } = await initNoir()
    const proof = await noir.generateFinalProof(inputs)
    assert(await noir.verifyFinalProof(proof), 'Could not verify proof offchain')
    return proof
}
