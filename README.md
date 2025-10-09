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
const subscription = window.nostrdb.filters(
  [{ kinds: [1], authors: [pubkey] }],
  {
    event: (event) => console.log("New event:", event),
    error: (error) => console.error("Error:", error),
    complete: () => console.log("Query complete"),
  },
);

// Clean up subscription
subscription.close();
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
  filters(filters: Filter[], handlers?: StreamHandlers): Subscription;

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
