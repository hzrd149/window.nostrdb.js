# window.nostrdb.js

A polyfill implementation of the [NIP-DB](https://github.com/hzrd149/nostr-bucket/blob/master/nip.md) specification that provides a `window.nostrdb` API for web applications when browser extensions are not available.

## Overview

This library implements the NIP-DB standard interface, allowing web applications to store and query Nostr events locally in the browser without requiring a browser extension. Backend selection is lazy and per-request:

1. **NostrIDB** (default) — events are stored in the browser's IndexedDB via [`nostr-idb`](https://github.com/hzrd149/nostr-idb). This is always the fallback and is used when no local relays are configured.
2. **Local Relay** (opt-in) — if the app sets `localRelays` in its config, each request checks NIP-11 reachability (cached briefly) and routes to those relays when any are available, otherwise falls back to NostrIDB.

No connection attempts are made at import time. Backend modules and local relay probes are loaded lazily the first time a request needs them.

## Features

- Full NIP-DB compliance (`add`, `event`, `replaceable`, `count`, `query`, `subscribe`, `supports`)
- Local relay pool with NIP-50 search detection
- IndexedDB fallback backend
- TypeScript definitions included

## Installation

### NPM/Bun/Yarn

```bash
npm install window.nostrdb.js
# or
bun add window.nostrdb.js
# or
yarn add window.nostrdb.js
```

### CDN (Script Tag)

```html
<script type="module" src="https://unpkg.com/window.nostrdb.js"></script>
```

The library automatically polyfills `window.nostrdb` when loaded.

## Configuration

Local relay support is **opt-in**. By default the library uses only the NostrIDB backend and makes no network connections. To enable local relay routing at startup, set `window.nostrdbConfig` **before** importing the library.

```typescript
interface NostrDBConfig {
  /** Local relay URLs to route requests to. Empty array (the default) disables the local relay and uses only NostrIDB. */
  localRelays: string[];
}
```

### Default Configuration

```javascript
{
  localRelays: [],
}
```

### Routing Behavior

When `localRelays` is non-empty, each request checks whether the configured relays are reachable via NIP-11, but at most once per minute. The result is cached and reused for subsequent requests within that window. Any reachable relay routes the request to the local relay backend. If none are reachable, the request routes to NostrIDB.

Long-lived subscriptions are bound to whichever backend was chosen when the subscription started. Runtime configuration changes apply to new operations and subscriptions, not subscriptions that are already running.

### Runtime switching

After the polyfill is installed, call `window.nostrdb.configure(...)` to switch backend routing without reloading the page. This clears cached relay availability and creates a new local relay backend for future operations.

```javascript
// Prefer a local relay for future operations when reachable.
window.nostrdb.configure({
  localRelays: ["ws://localhost:4869/"],
});

// Switch future operations back to IndexedDB-only mode.
window.nostrdb.configure({
  localRelays: [],
});
```

### Examples

#### Enable a single local relay

```javascript
window.nostrdbConfig = {
  localRelays: ["ws://localhost:4869/"],
};

import "window.nostrdb.js";
```

#### Multiple local relays

```javascript
window.nostrdbConfig = {
  localRelays: [
    "ws://localhost:4869/",
    "ws://localhost:8080/",
    "ws://localhost:7777/",
  ],
};

import "window.nostrdb.js";
```

#### HTML script tag

```html
<!DOCTYPE html>
<html>
  <head>
    <script>
      window.nostrdbConfig = {
        localRelays: ["ws://localhost:4869/"],
      };
    </script>
    <script type="module" src="https://unpkg.com/window.nostrdb.js"></script>
  </head>
</html>
```

## Usage

```javascript
import "window.nostrdb.js";

// Add an event
const success = await window.nostrdb.add(nostrEvent);

// Get a specific event by ID
const event = await window.nostrdb.event(eventId);

// Get the latest replaceable event (e.g., profile)
const profile = await window.nostrdb.replaceable(0, pubkey);

// Get a parameterized-replaceable event with identifier
const list = await window.nostrdb.replaceable(30000, pubkey, "mylist");

// Count events matching filters
const count = await window.nostrdb.count({ kinds: [1] });

// Query events
const events = await window.nostrdb.query([{ kinds: [1], authors: [pubkey] }]);

// Subscribe to events (async iterator)
for await (const event of window.nostrdb.subscribe([{ kinds: [1] }])) {
  console.log("New event:", event);
}

// Feature detection
const features = await window.nostrdb.supports();
if (features.includes("search")) {
  const results = await window.nostrdb.query({ kinds: [1], search: "nostr" });
}
```

## API Reference

```typescript
interface IWindowNostrDB {
  /** Add an event to the database */
  add(event: NostrEvent): Promise<boolean>;

  /** Get a single event by ID */
  event(id: string): Promise<NostrEvent | undefined>;

  /** Get the latest version of a replaceable event */
  replaceable(
    kind: number,
    author: string,
    identifier?: string,
  ): Promise<NostrEvent | undefined>;

  /** Count the number of events matching filters */
  count(filters: Filter | Filter[]): Promise<number>;

  /** Check which optional features the backend supports */
  supports(): Promise<string[]>;

  /** Get events by filters */
  query(filters: Filter | Filter[]): Promise<NostrEvent[]>;

  /** Subscribe to events matching the filters */
  subscribe(filters: Filter | Filter[]): AsyncGenerator<NostrEvent>;
}
```

### Known features

- `"search"` — NIP-50 full-text search is supported by at least one backing relay.

## Browser Compatibility

Requires a modern browser with IndexedDB, ES modules, and async/await support.

## Related Projects

- [nostr-bucket](https://github.com/hzrd149/nostr-bucket) — reference browser extension implementation
- [nostr-idb](https://github.com/hzrd149/nostr-idb) — IndexedDB backend for Nostr
- [applesauce-relay](https://github.com/hzrd149/applesauce) — relay pool used by the local-relay backend
