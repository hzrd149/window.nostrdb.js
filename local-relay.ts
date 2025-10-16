import type { UpstreamPool } from "applesauce-loaders";
import {
  createAddressLoader,
  createEventLoader,
  type AddressPointerLoader,
  type EventPointerLoader,
} from "applesauce-loaders/loaders";
import { onlyEvents, Relay } from "applesauce-relay";
import { type Filter, type NostrEvent } from "nostr-tools";
import type { ProfilePointer } from "nostr-tools/nip19";
import { insertEventIntoDescendingList } from "nostr-tools/utils";
import { defaultIfEmpty, firstValueFrom, lastValueFrom, scan } from "rxjs";
import {
  Features,
  IWindowNostrDB,
  StreamHandlers,
  Subscription,
} from "./interface.js";

export class LocalRelay implements IWindowNostrDB {
  private relay: Relay;
  private eventLoader: EventPointerLoader;
  private addressLoader: AddressPointerLoader;

  constructor(url: string) {
    this.relay = new Relay(url);

    const upstream: UpstreamPool = (_relays, filters) =>
      this.relay.request(filters);

    // NOTE: These loaders to built to load from multiple relays.
    // this would be cleaner if it was built for a single relay
    this.eventLoader = createEventLoader(upstream, {
      extraRelays: [this.relay.url],
      bufferTime: 500,
    });
    this.addressLoader = createAddressLoader(upstream, {
      extraRelays: [this.relay.url],
      bufferTime: 500,
    });
  }

  /** Add an event to the relay */
  async add(event: NostrEvent): Promise<boolean> {
    const res = await this.relay.publish(event);
    return res.ok;
  }

  /** Get a single event by its ID */
  async event(id: string): Promise<NostrEvent | undefined> {
    return await lastValueFrom(
      this.eventLoader({ id }).pipe(defaultIfEmpty(undefined)),
    );
  }

  /** Get the latest replaceable event for a given kind, author, and optional identifier */
  async replaceable(
    kind: number,
    pubkey: string,
    identifier?: string,
  ): Promise<NostrEvent | undefined> {
    return await firstValueFrom(
      this.addressLoader({ kind, pubkey: pubkey, identifier }).pipe(
        defaultIfEmpty(undefined),
      ),
    );
  }

  /** Count events matching the given filters */
  async count(filters: Filter[]): Promise<number> {
    // TODO: using .request here because applesauce-relay does not support count() yet
    return await lastValueFrom(
      this.relay
        .request(filters)
        .pipe(
          onlyEvents(),
          scan((acc, _e) => acc + 1, 0),
        )
        .pipe(defaultIfEmpty(0)),
    );
  }

  /** Get events matching the given filters */
  async filters(filters: Filter[]): Promise<NostrEvent[]> {
    return await lastValueFrom(
      this.relay.request(filters).pipe(
        onlyEvents(),
        scan(
          (acc, event) => insertEventIntoDescendingList(acc, event),
          [] as NostrEvent[],
        ),
      ),
    );
  }

  /** Subscribe to events in the relay based on filters */
  subscribe(filters: Filter[], handlers: StreamHandlers): Subscription {
    const sub = this.relay.subscription(filters).pipe(onlyEvents()).subscribe({
      next: handlers.event,
      error: handlers.error,
      complete: handlers.complete,
    });
    return { close: () => sub.unsubscribe() };
  }

  /** Lookup user profiles by search query */
  async lookup(query: string, limit?: number): Promise<ProfilePointer[]> {
    if (!(await this.supports()).includes("search"))
      throw new Error("Search is not supported for local relay backend");

    const events = await this.filters([{ kinds: [0], search: query, limit }]);
    return events.map((e) => ({ pubkey: e.pubkey, relays: [this.relay.url] }));
  }

  /** Check if the database backend supports features */
  async supports(): Promise<Features[]> {
    const supportedFeatures: Features[] = ["subscribe"]; // Always support subscriptions

    const info = await this.relay.getInformation();
    if (info?.supported_nips.includes(50)) supportedFeatures.push("search");

    return supportedFeatures;
  }
}
