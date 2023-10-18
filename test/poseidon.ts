// @ts-ignore
import { buildPoseidonReference } from 'circomlibjs'

export type PoseidonHashFn = (inputs: any[]) => Uint8Array
export type Poseidon = PoseidonHashFn & {
    F: {
        e: (hex: string) => any
        toString: (input: any, radix: number) => string
    }
}

let poseidon: Poseidon
export async function getPoseidon(): Promise<Poseidon> {
    if (!poseidon) {
        poseidon = await buildPoseidonReference()
    }
    return poseidon
}
