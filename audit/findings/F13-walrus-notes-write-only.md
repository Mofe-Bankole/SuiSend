# F13 — Walrus notes are write-only; `walrus.move` is dead code

- **Severity:** P2
- **Area:** contracts / frontend
- **Phase:** 4 (claim page in F02 makes this visible)
- **Status:** Open

## Evidence

The write path works: `SendTab.tsx:172` uploads the note to Walrus, stores
`note_blob_id` in the `PaymentRecord` (`core.move:141`).

The read path does not exist:

1. No getter for `note_blob_id` in `core.move` (getters exist for sender,
   amount, expiry, state, coin_type — but not the note).
2. `lookupPayment` (`suisend.ts:144`) never fetches it.
3. `ClaimTab.tsx:159-162`:

```ts
const [walrusNote, setWalrusNote] = useState<string | null>(null);
useEffect(() => { setWalrusNote(null); }, [paymentInfo?.linkHash]);
```

State that is set to null and nothing else — a stub left by the previous model.

4. `sources/walrus.move` (44 lines, a typed wrapper for blob IDs) is not
   imported or used by any module — including `core.move`, which stores the
   blob id as a raw `vector<u8>` instead of the wrapper.

## Impact

Senders write notes that recipients never see. The feature is marketing
("Walrus" in the tech-stack table, a Walrus section in the send flow) without
delivery. Note upload also silently swallows failures
(`SendTab.tsx:176` — "continuing without blob") so users believe a note was
attached when it wasn't.

## Fix

1. v5: add `payment_note_blob_id(book, key): Option<vector<u8>>` getter.
2. Claim page (F02): after lookup, `hexToBlobId` (already in `walrus.ts`) →
   `readText(blobId, "mainnet")` → render. Cache in `sessionStorage`.
3. Surface upload failure honestly in SendTab: warn "note failed to save —
   payment will go through without it" instead of a console whisper.
4. Either use `walrus.move`'s `WalrusBlobId` in `PaymentRecord` (type safety)
   or delete the module. No dead code on mainnet.

## Verification

Create a payment with note "lunch 🍜" → open the claim link → the note
renders. Delete the Walrus blob externally (or use an expired blob) → the
claim page still works, note section degrades gracefully.
