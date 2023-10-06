// @ts-ignore
import { buildPoseidonReference } from 'circomlibjs'
import { sha256 } from '@noble/hashes/sha256'

type PoseidonHashFn = (inputs: any[]) => Uint8Array
type Poseidon = PoseidonHashFn & {
    F: {
        e: (hex: string) => any
        toString: (input: any, radix: number) => string
    }
}

function toHex(input: Uint8Array) {
    return (
        '0x' +
        Array.from(input)
            .map((v) => v.toString(16).padStart(2, '0'))
            .join('')
    )
}

function normaliseHex(hexString: string) {
    // Remove 0x prefix if present
    if (hexString.startsWith('0x')) {
        hexString = hexString.slice(2)
    }

    // Pad start with 0 to make length even
    if (hexString.length % 2 !== 0) {
        hexString = '0' + hexString
    }

    // Add the 0x prefix back in
    hexString = '0x' + hexString

    return hexString
}

async function main() {
    const poseidon: Poseidon = await buildPoseidonReference()

    const privKey = '0x94947e951e41f4ecd5e63124ac86c6893cb23cbb486912c5f155ed707d4e'
    const msgHash = toHex(sha256('Hello, world!'))
    console.log('msgHash:', msgHash)

    const pubKey = normaliseHex(poseidon.F.toString(poseidon([privKey]), 16))
    const sig = normaliseHex(poseidon.F.toString(poseidon([privKey, msgHash]), 16))
    console.log(`pubKey: ${pubKey}, sig: ${sig}`)
}

main().catch((err) => {
    console.error(err)
})
