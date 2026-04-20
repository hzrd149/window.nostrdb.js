# window.nostrdb.js

## 0.6.0

### Major Changes

- Align `window.nostrdb` with the latest NIP-DB: remove `lookup()` from the interface and drop the `"lookup"` feature flag
- `supports()` now returns `Promise<string[]>` (the `Features` type has been removed)
- Remove vertex, primal, and relatr lookup providers and their `NostrDBConfig` fields (`vertex`, `primal`, `relatr`, `lookupProviders`); `NostrDBConfig` now only contains `localRelays`
- Drop `@contextvm/sdk`, `@modelcontextprotocol/sdk`, `applesauce-extra`, and `applesauce-signers` dependencies

## 0.5.1

### Patch Changes

- 94da8d2: Fix indexeddb storage backend
- f41df96: Bump `@contextvm/sdk`

## 0.5.0

### Minor Changes

- 5c6b4ac: Add `lookupProviders` array to enable lookup providers and change the priority
- 5c6b4ac: Move primal and vertext settings into seperate objects in window.nostrdbConfig
- 5c6b4ac: Add support for [relatr](https://relatr.xyz/)
