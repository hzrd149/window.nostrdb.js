# AGENTS.md — Coding Agent Guide for `window.nostrdb.js`

## Project Overview

A browser polyfill that installs `window.nostrdb` (NIP-DB), backed by either a local
Nostr relay (`applesauce-relay` + RxJS) or an IndexedDB fallback (`nostr-idb`).
~7 TypeScript source files. Tooling: **Bun**.

---

## Commands

```sh
bun run build       # compile TypeScript → dist/, then bundle browser single-file
bun run compile     # tsc --noEmit false  (emit .js + .d.ts into dist/)
bun run bundle      # Bun browser bundle → dist/window.nostrdb.js
bun run format      # Prettier (run before every commit)
bun tsc --noEmit    # type-check only, no output
```

**Tests:** No test suite exists. Use `bun test` (built-in) if you add tests.
Run a single test file: `bun test src/path/to/file.test.ts`

**Linter:** None. Prettier only. Do not add ESLint or Biome.

---

## Module System

Pure ESM (`"type": "module"`). `moduleResolution: NodeNext` — **`.js` extensions are
required on every local relative import**, even though source files are `.ts`:

```ts
// Correct
import { LocalRelay } from "./events/local-relay.js";
import type { IWindowNostrDB } from "./interface.js";

// Wrong — resolution will fail at runtime
import { LocalRelay } from "./events/local-relay";
```

Use `import type` for type-only imports. Third-party imports never need extensions.
Use dynamic `import()` for lazy/conditional loading (see `src/index.ts`).

---

## TypeScript

`tsconfig.json` key settings — **do not change without a specific reason**:

| Option                       | Value        | Note                                                                |
| ---------------------------- | ------------ | ------------------------------------------------------------------- |
| `target` / `lib`             | ESNext + DOM | No Node.js globals (`process`, `Buffer`, `__dirname` are forbidden) |
| `moduleResolution`           | NodeNext     | Forces `.js` on local imports                                       |
| `strict`                     | true         | All strict checks on                                                |
| `noUncheckedIndexedAccess`   | true         | Index access returns `T \| undefined`                               |
| `noImplicitOverride`         | true         | Subclass overrides need `override` keyword                          |
| `noFallthroughCasesInSwitch` | true         | Every `case` must `break` or `return`                               |
| `noEmit`                     | true         | `compile` script overrides at CLI — deliberate                      |

---

## Naming Conventions

| Entity                      | Convention                                            | Examples                          |
| --------------------------- | ----------------------------------------------------- | --------------------------------- |
| Classes                     | `PascalCase`                                          | `LocalRelay`, `NostrIDBWrapper`   |
| Interfaces                  | `PascalCase`, `I`-prefixed for the main API interface | `IWindowNostrDB`                  |
| Types / aliases             | `PascalCase`                                          | `NostrDBConfig`, `Features`       |
| Functions / variables       | `camelCase`                                           | `primalLookup`, `connectedRelays` |
| Static class constants      | `SCREAMING_SNAKE_CASE`                                | `RelatrClient.SERVER_PUBKEY`      |
| Intentionally unused params | `_` prefix                                            | `_query`, `_limit`                |

- Use the `private` keyword — **never** ECMAScript `#` private fields.
- Prefer `interface` for object shapes; `type` for unions and simple aliases.

---

## Code Patterns

### `satisfies` for config objects

```ts
const defaultConfig = { timeout: 5000 } satisfies NostrDBConfig;
```

### Type predicates in `.filter()`

```ts
.filter((url): url is string => url !== null)
```

### `declare global` — keep in `src/interface.ts` only

```ts
declare global {
  interface Window {
    nostrdb: IWindowNostrDB;
  }
}
```

### Lazy module-level singletons (all lookup providers follow this)

```ts
let primal: PrimalCache | null = null;
// ...
if (!primal)
  primal = new PrimalCache(config.primal?.cache || DEFAULT_PRIMAL_RELAY);
```

### `async *` generators for streaming (bridge from RxJS push → pull)

`LocalRelay.subscribe()` uses an internal queue + Promise notifier; cleanup in `finally`.

### Deliberate `any` — document why

One `let sub: any` exists as a pragmatic workaround. Always add a comment if you must use `any`.

---

## Error Handling

- **Optional catch binding** — omit variable when unused:
  ```ts
  try {
    await connect(url);
  } catch {
    continue;
  }
  ```
- `console.warn` — non-fatal provider failures
- `console.error` — connection errors
- `console.log` — polyfill startup lifecycle
- `throw new Error(...)` — unrecoverable states only; never throw strings/objects
- Optional chaining (`?.`) for nullable config. Use `||` (not `??`) for string defaults.

---

## Architecture

```
src/
  index.ts          # Top-level await; side-effect polyfill install. No extra named exports.
  interface.ts      # IWindowNostrDB, NostrDBConfig, Features, window augmentation
  events/
    local-relay.ts  # LocalRelay — applesauce-relay + RxJS backend
    nostr-idb.ts    # NostrIDBWrapper — thin pass-through to nostr-idb v5
  lookup/
    primal.ts       # primalLookup() via applesauce-extra PrimalCache
    vertex.ts       # vertexLookup() via applesauce-extra
    relatr.ts       # lookupRelatr() via RelatrClient MCP
  ctxcn/
    RelatrClient.ts # CODE-GENERATED by ctxcn CLI — never hand-edit
```

- `LocalRelay` and `NostrIDBWrapper` both implement `IWindowNostrDB` — any new backend must too.
- `src/index.ts` uses top-level `await`; importing the package is the side effect.
- `src/ctxcn/RelatrClient.ts` is generated from `ctxcn.config.json` — regenerate with `ctxcn`.
- RxJS: use `firstValueFrom` / `lastValueFrom` with operators; never subscribe without unsubscribing.

---

## Formatting

- 2-space indent, spaces (not tabs) — `.prettierrc` enforces this.
- Semicolons on, trailing commas (ES5+) — Prettier defaults.
- Run `bun run format` before committing.

---

## Releases (Changesets)

```sh
bunx changeset          # create a changeset for any user-visible change
bunx changeset version  # bump package.json + CHANGELOG.md
bunx changeset publish  # publish to npm
```

Base branch: `master`. Package access: `restricted` (private npm).

---

## Do NOT

- Add ESLint, Biome, or any linter.
- Use `#` private fields — use `private` keyword.
- Omit `.js` extensions on local relative imports.
- Use `require()` or any CommonJS pattern.
- Hand-edit `src/ctxcn/RelatrClient.ts`.
- Use Node.js globals (`process`, `Buffer`, `__dirname`) — DOM lib only.
- Change `tsconfig.json`'s `noEmit: true` — the `compile` script overrides it at CLI.
- Add named exports to `src/index.ts` beyond what already exists.
