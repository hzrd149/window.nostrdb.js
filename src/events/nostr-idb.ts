import { NostrIDB as NostrIDBBackend } from "nostr-idb";
import type { NostrEvent } from "applesauce-core/helpers/event";
import type { Filter } from "applesauce-core/helpers/filter";
import type { IWindowNostrDB } from "../interface.js";

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

  async count(filters: Filter | Filter[]): Promise<number> {
    return this.backend.count(filters);
  }

  async supports(): Promise<string[]> {
    const raw = await this.backend.supports();
    return raw.filter((f): f is string => f === "search");
  }

  async query(filters: Filter | Filter[]): Promise<NostrEvent[]> {
    return this.backend.query(filters);
  }

  subscribe(filters: Filter | Filter[]): AsyncGenerator<NostrEvent> {
    return this.backend.subscribe(filters);
  }
}
