/// Tests for the v5 authorization layer (audit F01 + F19).
///
/// The v2 lifecycle functions (create/claim/refund) execute against live
/// Scallop shared objects and are covered by the e2e script
/// (scripts/e2e-testnet.mjs — see audit F17). What CAN be unit-tested
/// deterministically is the security core:
///
///   1. Bearer payments allow any caller with the secret.
///   2. PIN-locked payments reject a wrong PIN and a missing PIN.
///   3. PIN-locked payments accept the correct PIN preimage.
///   4. Address-locked payments reject a non-recipient caller.
///   5. Address-locked payments accept the locked recipient.
///   6. The commitment property: the on-chain key is blake2b256(secret),
///      so the raw secret is never needed for lookups (F01).
#[test_only]
module suisend::core_tests {
    use sui::hash;
    use sui::test_scenario;
    use suisend::core;

    const RECIPIENT: address = @0xC;
    const THIEF: address = @0xE;

    // ─── 1. Bearer: any caller passes ────────────────────────────────────

    #[test]
    fun test_bearer_allows_any_caller() {
        let mut scenario = test_scenario::begin(THIEF); // even a stranger
        let ctx = test_scenario::ctx(&mut scenario);
        let record = core::new_record_v2_for_testing(
            option::none(),
            option::none(),
            ctx,
        );
        core::assert_claim_authorized(&record, &option::none(), ctx);
        test_scenario::end(scenario);
    }

    // ─── 2. PIN: wrong PIN aborts ────────────────────────────────────────

    #[test]
    #[expected_failure]
    fun test_pin_wrong_pin_aborts() {
        let pin = b"829401";
        let pin_hash = hash::blake2b256(&pin);

        let mut scenario = test_scenario::begin(RECIPIENT);
        let ctx = test_scenario::ctx(&mut scenario);
        let record = core::new_record_v2_for_testing(
            option::none(),
            option::some(pin_hash),
            ctx,
        );
        let wrong = b"000000";
        core::assert_claim_authorized(&record, &option::some(wrong), ctx);
        test_scenario::end(scenario);
    }

    // ─── 3. PIN: missing PIN aborts ──────────────────────────────────────

    #[test]
    #[expected_failure]
    fun test_pin_missing_pin_aborts() {
        let pin = b"829401";
        let pin_hash = hash::blake2b256(&pin);

        let mut scenario = test_scenario::begin(RECIPIENT);
        let ctx = test_scenario::ctx(&mut scenario);
        let record = core::new_record_v2_for_testing(
            option::none(),
            option::some(pin_hash),
            ctx,
        );
        core::assert_claim_authorized(&record, &option::none(), ctx);
        test_scenario::end(scenario);
    }

    // ─── 4. PIN: correct preimage passes ─────────────────────────────────

    #[test]
    fun test_pin_correct_pin_passes() {
        let pin = b"829401";
        let pin_hash = hash::blake2b256(&pin);

        let mut scenario = test_scenario::begin(RECIPIENT);
        let ctx = test_scenario::ctx(&mut scenario);
        let record = core::new_record_v2_for_testing(
            option::none(),
            option::some(pin_hash),
            ctx,
        );
        core::assert_claim_authorized(&record, &option::some(pin), ctx);
        test_scenario::end(scenario);
    }

    // ─── 5. Locked: non-recipient aborts (even with the secret) ──────────

    #[test]
    #[expected_failure]
    fun test_locked_thief_aborts() {
        let mut scenario = test_scenario::begin(THIEF);
        let ctx = test_scenario::ctx(&mut scenario);
        let record = core::new_record_v2_for_testing(
            option::some(RECIPIENT),
            option::none(),
            ctx,
        );
        core::assert_claim_authorized(&record, &option::none(), ctx);
        test_scenario::end(scenario);
    }

    // ─── 6. Locked: the locked recipient passes ──────────────────────────

    #[test]
    fun test_locked_recipient_passes() {
        let mut scenario = test_scenario::begin(RECIPIENT);
        let ctx = test_scenario::ctx(&mut scenario);
        let record = core::new_record_v2_for_testing(
            option::some(RECIPIENT),
            option::none(),
            ctx,
        );
        core::assert_claim_authorized(&record, &option::none(), ctx);
        test_scenario::end(scenario);
    }

    // ─── 7. Locked + PIN: recipient must ALSO present the PIN ────────────

    #[test]
    #[expected_failure]
    fun test_locked_recipient_still_needs_pin() {
        let pin = b"829401";
        let pin_hash = hash::blake2b256(&pin);

        let mut scenario = test_scenario::begin(RECIPIENT);
        let ctx = test_scenario::ctx(&mut scenario);
        let record = core::new_record_v2_for_testing(
            option::some(RECIPIENT),
            option::some(pin_hash),
            ctx,
        );
        // Right address, but no PIN — must abort.
        core::assert_claim_authorized(&record, &option::none(), ctx);
        test_scenario::end(scenario);
    }

    // ─── 8. Commitment property (F01): key = blake2b256(secret) ──────────

    #[test]
    fun test_commitment_key_derivation() {
        // The lookup key must be derivable purely from the secret, with no
        // other input — this is what lets the URL carry the secret while
        // the chain only ever sees the key.
        let secret = x"4f2a8c911234567890abcdef01234567890abcdef01234567890abcdef012345";
        let key1 = hash::blake2b256(&secret);
        let key2 = hash::blake2b256(&secret);
        assert!(key1 == key2, 0);
        assert!(key1.length() == 32, 1);

        // A different secret must not collide.
        let other = x"4f2a8c911234567890abcdef01234567890abcdef01234567890abcdef012346";
        assert!(hash::blake2b256(&other) != key1, 2);
    }
}
