import {
  createAddressLoader,
  createEventLoader,
  type AddressPointerLoader,
  type EventPointerLoader,
} from "applesauce-loaders/loaders";
import { onlyEvents, RelayPool } from "applesauce-relay";
import {
  type NostrEvent,
  insertEventIntoDescendingList,
} from "applesauce-core/helpers/event";
import type { Filter } from "applesauce-core/helpers/filter";
import { firstValueFrom, lastValueFrom, scan } from "rxjs";
import type { IWindowNostrDB } from "../interface.js";

export class LocalRelay implements IWindowNostrDB {
  private pool: RelayPool;
  private urls: string[];
  private eventLoader: EventPointerLoader;
  private addressLoader: AddressPointerLoader;
  private relayInfoCache: Map<string, { supported_nips: number[] }> = new Map();

  constructor(urls: string[]) {
    this.pool = new RelayPool();
    this.urls = urls;

    this.eventLoader = createEventLoader(this.pool, {
      extraRelays: urls,
      bufferTime: 500,
    });
    this.addressLoader = createAddressLoader(this.pool, {
      extraRelays: urls,
      bufferTime: 500,
    });
  }

  /** Check if filters contain search queries */
  private hasSearchFilter(filters: Filter[]): boolean {
    return filters.some((filter) => "search" in filter && filter.search);
  }

  /** Get relay URLs that support NIP-50 search */
  private async getSearchSupportingRelayUrls(): Promise<string[]> {
    const searchRelayUrls: string[] = [];

    for (const url of this.urls) {
      try {
        let info = this.relayInfoCache.get(url);
        if (!info) {
          const relay = this.pool.relay(url);
          const relayInfo = await relay.getInformation();
          if (relayInfo && relayInfo.supported_nips) {
            info = relayInfo;
            this.relayInfoCache.set(url, info);
          }
        }
        if (info?.supported_nips?.includes(50)) {
          searchRelayUrls.push(url);
        }
      } catch {
        // Ignore relays that fail to provide info
      }
    }

    return searchRelayUrls;
  }

  /** Add an event to all relays in parallel */
  async add(event: NostrEvent): Promise<boolean> {
    const results = await this.pool.publish(this.urls, event);
    // Return true if at least one relay accepted the event
    return results.some((res) => res.ok);
  }

  /** Get a single event by its ID */
  async event(id: string): Promise<NostrEvent | undefined> {
    return await lastValueFrom(this.eventLoader({ id, relays: this.urls }), {
      defaultValue: undefined,
    });
  }

  /** Get the latest replaceable event for a given kind, author, and optional identifier */
  async replaceable(
    kind: number,
    pubkey: string,
    identifier?: string,
  ): Promise<NostrEvent | undefined> {
    return await firstValueFrom(
      this.addressLoader({
        kind,
        pubkey: pubkey,
        identifier,
        relays: this.urls,
      }),
      { defaultValue: undefined },
    );
  }

  /** Count events matching the given filters - try relays one at a time */
  async count(filters: Filter | Filter[]): Promise<number> {
    const filtersArray = Array.isArray(filters) ? filters : [filters];
    // Try relays one at a time until we get a result
    for (const url of this.urls) {
      try {
        const relay = this.pool.relay(url);
        const response = await lastValueFrom(relay.count(filtersArray), {
          defaultValue: undefined,
        });

        // Relay did not respond, try next relay
        if (response == undefined) continue;

        return response.count;
      } catch {
        // Try next relay
        continue;
      }
    }
    // If all relays fail, return 0
    return 0;
  }

  /** Get events matching the given filters from all relays in parallel */
  async query(filters: Filter | Filter[]): Promise<NostrEvent[]> {
    const filtersArray = Array.isArray(filters) ? filters : [filters];
    // If filters contain search, only use relays that support NIP-50
    const targetRelays = this.hasSearchFilter(filtersArray)
      ? await this.getSearchSupportingRelayUrls()
      : this.urls;

    if (targetRelays.length === 0) return [];

    return await lastValueFrom(
      this.pool
        .request(targetRelays, filtersArray)
        .pipe(
          scan(
            (acc: NostrEvent[], event: NostrEvent) =>
              insertEventIntoDescendingList(acc, event),
            [] as NostrEvent[],
          ),
        ),
      { defaultValue: [] as NostrEvent[] },
    );
  }

  /** Subscribe to events from all relays in parallel */
  async *subscribe(filters: Filter | Filter[]): AsyncGenerator<NostrEvent> {
    const filtersArray = Array.isArray(filters) ? filters : [filters];
    // If filters contain search, only use relays that support NIP-50
    const targetRelays = this.hasSearchFilter(filtersArray)
      ? await this.getSearchSupportingRelayUrls()
      : this.urls;

    if (targetRelays.length === 0) return;

    // Buffer events received while the consumer is processing
    const queue: NostrEvent[] = [];
    let done = false;
    let resolve: (() => void) | null = null;

    const sub = this.pool
      .subscription(targetRelays, filtersArray)
      .pipe(onlyEvents())
      .subscribe({
        next: (event: NostrEvent) => {
          queue.push(event);
          resolve?.();
          resolve = null;
        },
        error: () => {
          done = true;
          resolve?.();
          resolve = null;
        },
        complete: () => {
          done = true;
          resolve?.();
          resolve = null;
        },
      });

    try {
      while (!done || queue.length > 0) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          await new Promise<void>((r) => {
            resolve = r;
          });
        }
      }
    } finally {
      sub.unsubscribe();
    }
  }

  /** Check if the database backend supports features */
  async supports(): Promise<string[]> {
    const supportedFeatures: string[] = [];

    // Check if at least one relay supports NIP-50 search
    const searchRelays = await this.getSearchSupportingRelayUrls();
    if (searchRelays.length > 0) {
      supportedFeatures.push("search");
    }

    return supportedFeatures;
  }
}
