/// Walrus blob storage module for SuiSend (stub).
///
/// Stores payment metadata (sender's note, claim receipt) as Walrus blobs.
/// Each blob is identified by a unique `BlobID` that is stored in the
/// corresponding `PaymentRecord`.
///
/// ## Current status
/// This is a STUB for the devnet MVP. The Walrus SDK integration will be
/// added as a separate tracked step. For now:
///   - `store_note` is a no-op that returns a dummy ID
///   - `store_receipt` is a no-op that returns a dummy ID
///
/// ## Migration path
/// When the Walrus integration is ready:
///   1. Import the Walrus Move SDK (walrus::blob)
///   2. Replace dummy logic with real blob store/read calls
///   3. Remove this comment and the stub functions
module suisend::walrus {
    use sui::object::{Self, ID, UID};
    use sui::tx_context::TxContext;

    /// Error: Walrus blob storage not yet implemented.
    const ENotImplemented: u64 = 1;

    /// Store a payment note as a Walrus blob.
    ///
    /// In the stub version, this returns a newly generated ID without
    /// actually storing anything. The caller stores this ID in the
    /// PaymentRecord's `note_blob_id` field.
    ///
    /// ## Real implementation (future)
    /// ```move
    /// walrus::blob::store(sender_note, ctx)
    /// ```
    public fun store_note(
        _note_text: vector<u8>,
        ctx: &mut TxContext,
    ): ID {
        // STUB: Return a unique dummy ID. No data is stored.
        // When Walrus integration lands, replace the body with:
        //   walrus::blob::store(note_text, ctx)
        object::new(ctx)
    }

    /// Store a claim receipt as a Walrus blob.
    ///
    /// The receipt includes: payment link_hash, original amount, yield earned,
    /// total claimed, timestamp, and recipient address. This provides an
    /// immutable off-chain record.
    ///
    /// In the stub version, returns a newly generated dummy ID.
    public fun store_receipt(
        _receipt_data: vector<u8>,
        ctx: &mut TxContext,
    ): ID {
        // STUB: Return a unique dummy ID.
        object::new(ctx)
    }

    /// Read a blob from Walrus (query-only, no state change).
    ///
    /// Stub: asserts false since the data doesn't exist yet.
    public fun read_blob(_blob_id: ID): vector<u8> {
        abort ENotImplemented
    }
}
