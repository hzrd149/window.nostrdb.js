import type { SortMethod } from "applesauce-extra";
import type { ISigner } from "applesauce-signers";
import type { Filter, NostrEvent } from "nostr-tools";
import type { ProfilePointer } from "nostr-tools/nip19";

export type NostrDBConfig = {
  /** Override local relay */
  localRelay?: string;
  /** Override primal cache server */
  primalCache?: string;
  /** Use primal cache for user search */
  primalUserLookup: boolean;
  /** Override vertex relay */
  vertexRelay?: string;
  /** Use vertex cache for user search */
  vertexUserLookup: boolean;
  /** Method to use for vertex user search */
  vertexMethod: SortMethod;
  /** Override signer for vertex */
  vertexSigner?: () => Promise<ISigner | undefined>;
};

/** Generic type for a subscription */
export type Subscription = {
  close: () => void;
};

export type StreamHandlers = {
  event?: (event: NostrEvent) => void;
  error?: (error: Error) => void;
  complete?: () => void;
};

/** Standard enums for feature checks */
export type Features = "search" | "subscribe" | "lookup";

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

  /** Count the number of events matching a filter */
  count(filters: Filter[]): Promise<number>;

  /** Check if the database backend supports a feature */
  supports(): Promise<Features[]>;

  /** Get events by filters */
  filters(filters: Filter[]): Promise<NostrEvent[]>;

  /** Subscribe to events in the database based on filters */
  subscribe(filters: Filter[], handlers: StreamHandlers): Subscription;

  /** Lookup user profiles by search query */
  lookup(query: string, limit?: number): Promise<ProfilePointer[]>;
}

declare global {
  interface Window {
    nostrdbConfig?: Partial<NostrDBConfig>;
    nostrdb: IWindowNostrDB;
  }
}
