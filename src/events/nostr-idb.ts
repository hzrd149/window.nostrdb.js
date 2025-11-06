import { NostrIDB as NostrIDBBackend } from "nostr-idb";
import type { Filter, NostrEvent } from "nostr-tools";
import type { ProfilePointer } from "nostr-tools/nip19";
import {
  Features,
  IWindowNostrDB,
  StreamHandlers,
  Subscription,
} from "../interface.js";

/**
 * Wrapper for NostrIDB that implements the IWindowNostrDB interface
 */
export class NostrIDBWrapper implements IWindowNostrDB {
  private backend: NostrIDBBackend;

  constructor() {
    this.backend = new NostrIDBBackend();
  }

  async add(event: NostrEvent): Promise<boolean> {
    return this.backend.add(event);
  }

  async event(id: string): Promise<NostrEvent | undefined> {
    return this.backend.event(id);
  }

  async replaceable(
    kind: number,
    author: string,
    identifier?: string,
  ): Promise<NostrEvent | undefined> {
    return this.backend.replaceable(kind, author, identifier);
  }

  async count(filters: Filter[]): Promise<number> {
    return this.backend.count(filters);
  }

  async supports(): Promise<Features[]> {
    return this.backend.supports() as Promise<Features[]>;
  }

  async filters(filters: Filter[]): Promise<NostrEvent[]> {
    // @ts-expect-error - NostrIDB may have a different signature
    return this.backend.filters(filters);
  }

  subscribe(filters: Filter[], handlers: StreamHandlers): Subscription {
    const sub = this.backend.subscribe(filters, handlers);
    // NostrIDB returns a compatible subscription object
    return {
      close: () => {
        if ("close" in sub && typeof sub.close === "function") {
          sub.close();
        }
      },
    };
  }

  /** Lookup is not supported for nostr-idb backend */
  async lookup(_query: string, _limit?: number): Promise<ProfilePointer[]> {
    throw new Error("lookup is not supported for nostr-idb backend");
  }
}
