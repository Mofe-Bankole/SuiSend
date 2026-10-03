# F09 — `init_vault_generic<T>` is permissionless: anyone can fragment vaults

- **Severity:** P1
- **Area:** contracts
- **Phase:** 3
- **Status:** Open

## Evidence

`yield_scallop.move:256`:

```move
public fun init_vault_generic<T>(ctx: &mut TxContext) {
    let vault = ScallopYieldVaultGeneric<T> { ... };
    transfer::share_object(vault);
}
```

No capability, no registry check — any address can call this for any `T`,
any number of times, creating unlimited competing shared vaults per coin type.

## Impact

- The frontend hardcodes one USDC vault ID (`SCALLOP_YIELD_VAULT_USDC_ID`).
  Funds sent to a lookalike vault are not lost (each vault is self-contained
  and claims work against whichever vault holds the position), but the
  fragmented surface invites confusion: two "USDC vaults," inconsistent
  `active_position_count` stats, and an indexer that must now track N vaults.
- A griefer can spam thousands of shared objects at negligible cost, bloating
  the object graph the frontend must reason about.
- Combined with no events on vault creation, there is no clean way to
  enumerate "official" vaults.

## Fix

In v5: gate vault creation.

Option A (simplest): create the USDC vault in the package's `init` (or a
one-time admin call) and remove `init_vault_generic` from the public surface.
Option B: `init_vault_generic<T>(_: &AdminCap, ...)` — one vault per coin type,
admin-created, with a `VaultCreatedEvent` so indexers can enumerate them.

Also emit `VaultCreatedEvent { vault_id, coin_type }` either way.

## Verification

After upgrade, a non-admin call to create a vault aborts. The frontend's
hardcoded vault ID remains the only USDC vault, enumerable via the creation
event.
