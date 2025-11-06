# window.nostrdb.js

A polyfill implementation of the [NIP-DB](https://github.com/hzrd149/nostr-bucket/blob/master/nip.md) specification that provides a `window.nostrdb` API for web applications when browser extensions are not available.

## Overview

This library implements the NIP-DB standard interface using IndexedDB as the storage backend, allowing web applications to store and query Nostr events locally in the browser without requiring a browser extension.

## Features

- ✅ **Full NIP-DB Compliance**: Implements the complete `window.nostrdb` interface
- ✅ **IndexedDB Backend**: Uses `nostr-idb` for efficient local storage
- ✅ **Subscription Support**: Real-time event subscriptions
- ✅ **TypeScript Support**: Full TypeScript definitions included

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

You can also include the library directly in your HTML via CDN:

```html
<script type="module" src="https://unpkg.com/window.nostrdb.js"></script>
```

The library will automatically polyfill `window.nostrdb` when loaded via script tag.

## Configuration

You can configure `window.nostrdb.js` by setting `window.nostrdbConfig` **before** importing the library. This allows you to customize the backend, user lookup providers, and other options.

### Configuration Options

```typescript
interface NostrDBConfig {
  /** Array of local relay URLs to connect to in parallel */
  localRelays: string[];

  /** Primal lookup provider settings */
  primal?: {
    /** Primal cache server URL */
    cache?: string;
  };

  /** Vertex lookup provider settings */
  vertex?: {
    /** Vertex relay URL */
    relay?: string;
    /** Method to use for vertex user search */
    method: "globalPagerank" | "following" | "followers" | "mutuals";
    /** Signer for vertex */
    signer?: () => Promise<ISigner | undefined>;
  };

  /** Relatr lookup provider settings */
  relatr?: {
    /** Relatr server pubkey */
    pubkey: string;
    /** Relays to connect to Relatr server */
    relays: string[];
  };

  /** Ordered array of lookup providers to try (in order) */
  lookupProviders: Array<"vertex" | "primal" | "local" | "relatr">;
}
```

### Default Configuration

```javascript
{
  localRelays: ["ws://localhost:4869/"],
  primal: {},
  vertex: {
    method: "globalPagerank",
  },
  relatr: {
    pubkey: "750682303c9f0ddad75941b49edc9d46e3ed306b9ee3335338a21a3e404c5fa3",
    relays: ["wss://relay.contextvm.org"],
  },
  lookupProviders: ["primal", "relatr", "local"],
}
```

### Configuration Examples

#### Basic Configuration (Custom Local Relay)

```javascript
// Set config before importing
window.nostrdbConfig = {
  localRelays: ["ws://localhost:8080/"],
};

import "window.nostrdb.js";
```

#### Multiple Local Relays

```javascript
// Connect to multiple local relays in parallel
window.nostrdbConfig = {
  localRelays: [
    "ws://localhost:4869/",
    "ws://localhost:8080/",
    "ws://localhost:7777/",
  ],
};

import "window.nostrdb.js";
```

#### Using Vertex for User Lookup

```javascript
import { Nip07Signer } from "applesauce-signers/nip07";

window.nostrdbConfig = {
  vertex: {
    method: "following",
    signer: async () => new Nip07Signer(),
  },
  lookupProviders: ["vertex"],
};

import "window.nostrdb.js";

// Now lookup will use Vertex
const users = await window.nostrdb.lookup("satoshi");
```

#### Custom Primal Cache Server

```javascript
window.nostrdbConfig = {
  primal: {
    cache: "wss://my-primal-cache.example.com",
  },
  lookupProviders: ["primal"],
};

import "window.nostrdb.js";
```

#### Using Relatr for Trust-Scored User Lookup

```javascript
// Use Relatr with custom server configuration
window.nostrdbConfig = {
  relatr: {
    pubkey: "750682303c9f0ddad75941b49edc9d46e3ed306b9ee3335338a21a3e404c5fa3",
    relays: ["wss://relay.contextvm.org"],
  },
  lookupProviders: ["relatr"],
};

import "window.nostrdb.js";

// Now lookup will use Relatr for trust-scored results
const users = await window.nostrdb.lookup("satoshi");
```

#### Multiple Lookup Providers with Fallback

```javascript
import { Nip07Signer } from "applesauce-signers/nip07";

// Try Vertex first, then Primal, then Relatr, then local relay
window.nostrdbConfig = {
  vertex: {
    method: "following",
    signer: async () => new Nip07Signer(),
  },
  primal: {},
  relatr: {
    pubkey: "750682303c9f0ddad75941b49edc9d46e3ed306b9ee3335338a21a3e404c5fa3",
    relays: ["wss://relay.contextvm.org"],
  },
  lookupProviders: ["vertex", "primal", "relatr", "local"],
};

import "window.nostrdb.js";
```

#### Disable All Lookup Providers

```javascript
window.nostrdbConfig = {
  lookupProviders: [],
};

import "window.nostrdb.js";
```

#### HTML Script Tag Configuration

```html
<!DOCTYPE html>
<html>
  <head>
    <script>
      // Configure before loading the module
      window.nostrdbConfig = {
        localRelays: ["ws://localhost:8080/"],
        lookupProviders: ["primal"],
      };
    </script>
    <script type="module" src="https://unpkg.com/window.nostrdb.js"></script>
  </head>
  <body>
    <script>
      // window.nostrdb is now available with custom config
      window.nostrdb.lookup("satoshi").then((users) => {
        console.log("Found users:", users);
      });
    </script>
  </body>
</html>
```

### Backend Selection

The library automatically selects a backend by attempting to connect to all configured local relays in parallel:

1. **Local Relay** (preferred): If one or more local relays are available from the configured URLs (default: `["ws://localhost:4869/"]`), they will be used. The library checks by making HTTP requests to each relay's info endpoint in parallel.

2. **NostrIDB** (fallback): If no local relays are available, the library falls back to using `nostr-idb`, which stores events in the browser's IndexedDB.

### User Lookup Providers

The `lookup()` method tries providers in the order specified in the `lookupProviders` array. If a provider fails, it automatically tries the next one.

- **Primal** (`"primal"`): Uses Primal's cache server for user search. Enabled by default.
- **Relatr** (`"relatr"`): Uses Relatr for trust-scored user search based on social graph analysis. Enabled by default. Requires pubkey and relays to be configured.
- **Vertex** (`"vertex"`): Uses Vertex for personalized user search based on your social graph. Requires a signer to be configured.
- **Local** (`"local"`): Uses the local relay or IndexedDB backend for user search (requires NIP-50 search support).

**Example lookup flow:** If `lookupProviders: ["vertex", "primal", "relatr", "local"]` is configured:

1. First tries Vertex (if signer is configured)
2. If Vertex fails or signer is missing, tries Primal
3. If Primal fails, tries Relatr (if pubkey and relays are configured)
4. If Relatr fails, tries the local backend
5. If all fail, throws an error

## Usage

### ES Modules (NPM/CDN)

Simply import the library and it will automatically polyfill `window.nostrdb` if it doesn't exist:

```javascript
import "window.nostrdb.js";

// window.nostrdb is now available
const success = await window.nostrdb.add(nostrEvent);
```

### Script Tag (CDN)

When using the script tag, the library automatically polyfills `window.nostrdb`:

```html
<!DOCTYPE html>
<html>
  <head>
    <script type="module" src="https://unpkg.com/window.nostrdb.js"></script>
  </head>
  <body>
    <script>
      // window.nostrdb is automatically available
      const success = await window.nostrdb.add(nostrEvent);
    </script>
  </body>
</html>
```

### TypeScript Usage

```typescript
import "window.nostrdb.js";
import type { NostrEvent, Filter } from "nostr-tools";

// TypeScript will recognize window.nostrdb
const event: NostrEvent | undefined = await window.nostrdb.event(eventId);
```

### API Examples

#### Adding Events

```javascript
// Add a new event to the database
const success = await window.nostrdb.add(nostrEvent);
console.log("Event added:", success);
```

#### Retrieving Events

```javascript
// Get a specific event by ID
const event = await window.nostrdb.event(eventId);

// Get the latest replaceable event (e.g., profile)
const profile = await window.nostrdb.replaceable(0, pubkey);

// Get latest replaceable event with identifier
const list = await window.nostrdb.replaceable(30000, pubkey, "mylist");
```

#### Querying Events

```javascript
// Count events matching filters
const count = await window.nostrdb.count([{ kinds: [1] }]);

// Get events with filters
const events = await window.nostrdb.filters([
  { kinds: [1], authors: [pubkey] },
]);
console.log("Found events:", events);
```

#### Real-time Subscriptions

```javascript
// Subscribe to new events
const subscription = window.nostrdb.subscribe([{ kinds: [1] }], {
  event: (event) => {
    console.log("New note:", event.content);
  },
  error: (error) => console.error("Subscription error:", error),
  complete: () => console.log("Subscription ended"),
});

// Close subscription when done
subscription.close();
```

#### Feature Detection

```javascript
// Check supported features
const features = await window.nostrdb.supports();
console.log("Supported features:", features);

// Check for specific features
if (features.includes("subscribe")) {
  console.log("Real-time subscriptions supported");
}
```

## API Reference

### `IWindowNostrDB` Interface

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
  count(filters: Filter[]): Promise<number>;

  /** Check if the database backend supports features */
  supports(): Promise<Features[]>;

  /** Get events by filters */
  filters(filters: Filter[]): Promise<NostrEvent[]>;

  /** Subscribe to events in the database based on filters */
  subscribe(filters: Filter[], handlers?: StreamHandlers): Subscription;

  /** Lookup user profiles by search query */
  lookup(query: string, limit?: number): Promise<ProfilePointer[]>;
}
```

### Supporting Types

```typescript
type Subscription = {
  close: () => void;
};

type StreamHandlers = {
  event?: (event: NostrEvent) => void;
  error?: (error: Error) => void;
  complete?: () => void;
};

enum Features {
  Search = "search",
  Subscribe = "subscribe",
}
```

## Browser Compatibility

This polyfill works in all modern browsers that support:

- IndexedDB
- ES6 Modules
- Async/Await

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related Projects

- [nostr-bucket](https://github.com/hzrd149/nostr-bucket) - Reference browser extension implementation
- [nostr-idb](https://github.com/hzrd149/nostr-idb) - IndexedDB backend for Nostr
- [nostr-tools](https://github.com/nbd-wtf/nostr-tools) - Nostr utilities and types
- [Relatr](https://github.com/ContextVM/relatr) - Trust-scored user search based on social graph analysis
- [applesauce-extra](https://github.com/hzrd149/applesauce-signer) - Nostr utilities including Primal and Vertex support
