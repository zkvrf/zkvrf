// @ts-ignore
import { buildPoseidonReference } from 'circomlibjs'

export const P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n

export type PoseidonHashFn = (inputs: any[]) => Uint8Array
export type Poseidon = PoseidonHashFn & {
    F: {
        e: (hex: string) => any
        toString: (input: any, radix: number) => string
    }
}

let _poseidon: Poseidon
export async function getPoseidon(): Promise<Poseidon> {
    if (!_poseidon) {
        _poseidon = await buildPoseidonReference()
    }
    return _poseidon
}

export async function poseidon(values: (string | number | bigint)[]) {
    if (!values.every((value) => BigInt(value) < P)) {
        throw new Error('Invalid field value')
    }
    const p = await getPoseidon()
    return '0x' + p.F.toString(p(values), 16).padStart(64, '0')
}
