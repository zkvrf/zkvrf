use dep::std::hash::poseidon::bn254::hash_1;
use dep::std::hash::poseidon::bn254::hash_2;
use dep::std::hash::poseidon::bn254::hash_3;

/// @notice Custom PK crypto scheme using Poseidon hash
/// @param private_key Private/secret key, hidden ZKP input
/// @param public_key Public key
/// @param message_hash Message, hashed to field
/// @return signature
fn main(
    private_key: Field,
    public_key: pub Field,
    message_hash: pub Field
) -> pub [Field; 2] {
    // The prover must know SK where PK = H(SK)
    assert(public_key == hash_1([private_key]));
    // Ideally, we want an entropy source of 256 bits, but a BN254 field is of
    // size ~254 bits. So we use the HMAC construction to produce 2 hashes,
    // producing ~508 bits of entropy:
    //  H(SK, H(SK, Msg, 0))
    //  H(SK, H(SK, Msg, 1))
    [
        hash_2([private_key, hash_3([private_key, message_hash, 0])]),
        hash_2([private_key, hash_3([private_key, message_hash, 1])])
    ]
}

#[test]
fn test_main() {
    let result = main(
        0x01c8bdf6686d4c8ba09db5f15ffee3c470a5e0ff54d6fbac3a548f9a666977,
        0x15d76b9641dc1e52de6f9530a4161f077c348b1329efaeb0e052f13b5bf1ce49,
        0x003f46cee85de01c829c15a96765a024b48687825bca602b2124485dad9612a4
    );
    assert(result[0] == 0x1936f2209a2b048aa72fac77d56b9627a870449cf357de9744a54dafa0be8202);
    assert(result[1] == 0x25f0e32ce893cadb55ac7483237e554b03659b4498afe9a9d977e094ab1d68d1);
}
