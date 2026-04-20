import type { NostrEvent } from "applesauce-core/helpers/event";
import type { Filter } from "applesauce-core/helpers/filter";

export type NostrDBConfig = {
  /** Array of local relay URLs to connect to in parallel */
  localRelays: string[];
};

/** Main interface for the nostr event store */
export interface IWindowNostrDB {
  /** Add an event to the database */
  add(event: NostrEvent): Promise<boolean>;

  /** Get a single event */
  event(id: string): Promise<NostrEvent | undefined>;

  /** Get the latest version of a replaceable event */
  replaceable(
    kind: number,
    author: string,
    identifier?: string,
  ): Promise<NostrEvent | undefined>;

  /** Count the number of events matching filters */
  count(filters: Filter | Filter[]): Promise<number>;

  /** Check if the database backend supports optional features */
  supports(): Promise<string[]>;

  /** Get events by filters */
  query(filters: Filter | Filter[]): Promise<NostrEvent[]>;

  /** Subscribe to events in the database based on filters */
  subscribe(filters: Filter | Filter[]): AsyncGenerator<NostrEvent>;
}

declare global {
  interface Window {
    nostrdbConfig?: Partial<NostrDBConfig>;
    nostrdb: IWindowNostrDB;
  }
}
