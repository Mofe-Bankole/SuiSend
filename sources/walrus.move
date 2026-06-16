/// Walrus blob storage module for SuiSend.
///
/// Walrus upload is an **off-chain** operation — the frontend uploads note
/// text (and optionally claim receipts) to the Walrus HTTP publisher, then
/// passes the resulting blob ID as raw bytes into the on-chain contract.
///
/// ## Lifecycle
/// 1. Sender writes a note in the UI.
/// 2. Frontend uploads the note to Walrus via `PUT /v1/blobs?epochs=N`.
/// 3. Frontend captures the `blobId` from the publisher response.
/// 4. Sender calls `create_payment_scallop(..., note_blob_id = some(blobId))`.
/// 5. On claim, the frontend reads the blob from Walrus via
///    `GET /v1/blobs/{blobId}` and displays the note.
///
/// ## Blob ID type
/// Walrus blob IDs are base64url-encoded strings in transit. On chain they
/// are stored as raw `vector<u8>`. Convert at the API boundary.
///
/// ## Endpoints (testnet)
/// - Publisher:  https://publisher.walrus-testnet.walrus.space
/// - Aggregator: https://aggregator.walrus-testnet.walrus.space
///
/// ## Epochs
/// 1 epoch ≈ 1 day on testnet, ~2 weeks on mainnet. Use 5-12 epochs for
/// short-lived payment notes; use permanent (default) for claim receipts.
module suisend::walrus {
    /// A typed wrapper around a Walrus blob ID stored on chain.
    ///
    /// Using a fresh struct instead of raw `vector<u8>` makes Object
    /// inspection more readable and prevents type confusion.
    public struct WalrusBlobId has store, copy, drop {
        bytes: vector<u8>,
    }

    /// Wrap raw blob ID bytes into a typed WalrusBlobId.
    public fun from_bytes(bytes: vector<u8>): WalrusBlobId {
        WalrusBlobId { bytes }
    }

    /// Unwrap a WalrusBlobId back to raw bytes for off-chain use.
    public fun to_bytes(id: &WalrusBlobId): vector<u8> {
        id.bytes
    }
}
