import { NostrIDB as NostrIDBBackend } from "nostr-idb";
import type { Filter, NostrEvent } from "nostr-tools";
import type { ProfilePointer } from "nostr-tools/nip19";
import { Features, IWindowNostrDB } from "../interface.js";

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

  async supports(): Promise<Features[]> {
    const raw = await this.backend.supports();
    return raw.filter((f): f is Features => f === "search" || f === "lookup");
  }

  async query(filters: Filter | Filter[]): Promise<NostrEvent[]> {
    return this.backend.query(filters);
  }

  subscribe(filters: Filter | Filter[]): AsyncGenerator<NostrEvent> {
    return this.backend.subscribe(filters);
  }

  /** Lookup is not supported for nostr-idb backend */
  async lookup(_query: string, _limit?: number): Promise<ProfilePointer[]> {
    throw new Error("lookup is not supported for nostr-idb backend");
  }
}
