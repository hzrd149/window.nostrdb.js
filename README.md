# window.nostrdb.js

A polyfill implementation of the [NIP-DB](https://github.com/hzrd149/nostr-bucket/blob/master/nip.md) specification that provides a `window.nostrdb` API for web applications when browser extensions are not available.

## Overview

This library implements the NIP-DB standard interface, allowing web applications to store and query Nostr events locally in the browser without requiring a browser extension. It selects a backend at load time:

1. **Local Relay** (preferred) — if at least one configured local relay URL responds to NIP-11 info, the library proxies all operations to those relays in parallel.
2. **NostrIDB** (fallback) — if no local relays are reachable, events are stored in the browser's IndexedDB via [`nostr-idb`](https://github.com/hzrd149/nostr-idb).

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

Set `window.nostrdbConfig` **before** importing the library to customize the local relay URLs.

```typescript
interface NostrDBConfig {
  /** Array of local relay URLs to connect to in parallel */
  localRelays: string[];
}
```

### Default Configuration

```javascript
{
  localRelays: ["ws://localhost:4869/"],
}
```

### Examples

#### Custom local relay

```javascript
window.nostrdbConfig = {
  localRelays: ["ws://localhost:8080/"],
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
        localRelays: ["ws://localhost:8080/"],
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
