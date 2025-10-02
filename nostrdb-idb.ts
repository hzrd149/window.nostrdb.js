import {
  getEventsFromAddressPointers,
  openDB,
  RelayCore,
  type NostrIDB,
} from "nostr-idb";
import type { Filter, NostrEvent } from "nostr-tools";
import {
  Features,
  type IWindowNostrDB,
  type StreamHandlers,
  type Subscription,
} from "./interface.js";

export class IndexedDBNostrDB implements IWindowNostrDB {
  private idb: NostrIDB | null = null;
  private async getDatabase(): Promise<NostrIDB> {
    if (!this.idb) this.idb = await openDB();
    return this.idb;
  }

  private relay: RelayCore | null = null;
  private async getRelay(): Promise<RelayCore> {
    if (!this.relay) this.relay = new RelayCore(await this.getDatabase());
    return this.relay;
  }

  /** Add an event to the database */
  async add(event: NostrEvent): Promise<boolean> {
    const relay = await this.getRelay();
    await relay.publish(event);
    return true;
  }

  /** Get a single event by its ID */
  async event(id: string): Promise<NostrEvent | undefined> {
    const db = await this.getDatabase();
    const result = await db.get("events", id);
    return result?.event;
  }

  /** Get the latest replaceable event for a given kind, author, and optional identifier */
  async replaceable(
    kind: number,
    author: string,
    identifier?: string,
  ): Promise<NostrEvent | undefined> {
    const db = await this.getDatabase();

    const events = await getEventsFromAddressPointers(db, [
      { kind, pubkey: author, identifier },
    ]);

    // Return the latest event (highest created_at)
    if (events.length === 0) return undefined;
    return events.reduce((a, b) => (b.created_at > a.created_at ? b : a));
  }

  /** Count events matching the given filters */
  async count(filters: Filter[]): Promise<number> {
    const relay = await this.getRelay();
    return await relay.count(filters);
  }

  /** Get events matching the given filters */
  filters(filters: Filter[], handlers?: StreamHandlers): Subscription {
    return this.subscribe(filters, handlers, true);
  }

  /** Subscribe to events in the database based on filters For IndexedDB, this is the same as filters since we don't have real-time updates */
  subscribe(
    filters: Filter[],
    handlers?: StreamHandlers,
    closeOnEose?: boolean,
  ): Subscription {
    // Define an empty close function
    let close = () => {};

    // Get the relay and subscribe to events
    this.getRelay()
      .then((relay) => {
        const sub = relay.subscribe(filters, {
          onevent: handlers?.event,
          oneose: () => closeOnEose && close(),
          onclose: (reason) => {
            if (reason) handlers?.error?.(new Error(reason));
            else handlers?.complete?.();
          },
        });

        close = () => sub.close();
      })
      .catch((err) => {
        if (handlers?.error) handlers.error(err);
      });

    return {
      close: () => close(),
    };
  }

  /** Check if the database backend supports features */
  async supports(): Promise<Features[]> {
    return [Features.Subscribe];
  }
}
