use dep::std::hash::poseidon::bn254::hash_1;
use dep::std::hash::poseidon::bn254::hash_2;

/// @notice Custom PK crypto scheme using Poseidon hash
/// @param private_key Private/secret key, hidden ZKP input
/// @param public_key Public key
/// @param message_hash Message, hashed to field
/// @return signature
fn main(
    private_key: Field,
    public_key: pub Field,
    message_hash: pub Field
) -> pub Field {
    // The prover must know SK where PK = H(SK)
    assert(public_key == hash_1([private_key]));
    // Use the HMAC construction H(SK, H(SK, Msg))
    hash_2([private_key, hash_2([private_key, message_hash])])
}

#[test]
fn test_main() {
    assert(
        main(
            0x01c8bdf6686d4c8ba09db5f15ffee3c470a5e0ff54d6fbac3a548f9a666977,
            0x15d76b9641dc1e52de6f9530a4161f077c348b1329efaeb0e052f13b5bf1ce49,
            0x3f46cee85de01c829c15a96765a024b48687825bca602b2124485dad9612a4
        ) == 0x2d95edff9b8ce78998b112d3160a954cb20214d8aa3e2c7eb11377f08e6207c0);
}
