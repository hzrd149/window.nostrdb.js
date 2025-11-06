import {
  createAddressLoader,
  createEventLoader,
  type AddressPointerLoader,
  type EventPointerLoader,
} from "applesauce-loaders/loaders";
import { onlyEvents, RelayPool } from "applesauce-relay";
import { type Filter, type NostrEvent } from "nostr-tools";
import type { ProfilePointer } from "nostr-tools/nip19";
import { insertEventIntoDescendingList } from "nostr-tools/utils";
import { defaultIfEmpty, firstValueFrom, lastValueFrom, scan } from "rxjs";
import {
  Features,
  IWindowNostrDB,
  StreamHandlers,
  Subscription,
} from "../interface.js";

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
    return await lastValueFrom(
      this.eventLoader({ id, relays: this.urls }).pipe(
        defaultIfEmpty(undefined),
      ),
    );
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
      }).pipe(defaultIfEmpty(undefined)),
    );
  }

  /** Count events matching the given filters - try relays one at a time */
  async count(filters: Filter[]): Promise<number> {
    // Try relays one at a time until we get a result
    for (const url of this.urls) {
      try {
        const relay = this.pool.relay(url);
        const response = await lastValueFrom(
          relay.count(filters).pipe(defaultIfEmpty(undefined)),
        );

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
  async filters(filters: Filter[]): Promise<NostrEvent[]> {
    // If filters contain search, only use relays that support NIP-50
    const targetRelays = this.hasSearchFilter(filters)
      ? await this.getSearchSupportingRelayUrls()
      : this.urls;

    if (targetRelays.length === 0) return [];

    return await lastValueFrom(
      this.pool.request(targetRelays, filters).pipe(
        scan(
          (acc: NostrEvent[], event: NostrEvent) =>
            insertEventIntoDescendingList(acc, event),
          [] as NostrEvent[],
        ),
        defaultIfEmpty([] as NostrEvent[]),
      ),
    );
  }

  /** Subscribe to events from all relays in parallel */
  subscribe(filters: Filter[], handlers: StreamHandlers): Subscription {
    // If filters contain search, only use relays that support NIP-50
    // We need to handle this asynchronously
    let sub: any;

    (async () => {
      const targetRelays = this.hasSearchFilter(filters)
        ? await this.getSearchSupportingRelayUrls()
        : this.urls;

      if (targetRelays.length === 0) {
        handlers.error?.(new Error("No relays support search for this query"));
        return;
      }

      sub = this.pool
        .subscription(targetRelays, filters)
        .pipe(onlyEvents())
        .subscribe({
          next: handlers.event,
          error: handlers.error,
          complete: handlers.complete,
        });
    })();

    return {
      close: () => {
        if (sub) sub.unsubscribe();
      },
    };
  }

  /** Lookup user profiles by search query using NIP-50 search */
  async lookup(query: string, limit: number = 10): Promise<ProfilePointer[]> {
    // Get relays that support NIP-50 search
    const searchRelays = await this.getSearchSupportingRelayUrls();

    if (searchRelays.length === 0)
      throw new Error("No local relays support NIP-50 search");

    // Create filter for kind 0 (profile metadata) with NIP-50 search
    const filters: Filter[] = [
      {
        kinds: [0],
        search: query,
        limit: limit,
      },
    ];

    // Try each relay in order until we get results
    for (const url of searchRelays) {
      try {
        const relay = this.pool.relay(url);
        const events = await lastValueFrom(
          relay.request(filters).pipe(
            scan(
              (acc: NostrEvent[], event: NostrEvent) =>
                insertEventIntoDescendingList(acc, event),
              [] as NostrEvent[],
            ),
            defaultIfEmpty([] as NostrEvent[]),
          ),
        );

        // If we got results, convert them to ProfilePointers and return
        if (events.length > 0) {
          // Deduplicate by pubkey (keep the latest event for each pubkey)
          const pubkeyMap = new Map<string, NostrEvent>();
          for (const event of events) {
            const existing = pubkeyMap.get(event.pubkey);
            if (!existing || event.created_at > existing.created_at) {
              pubkeyMap.set(event.pubkey, event);
            }
          }

          // Convert to ProfilePointers
          return Array.from(pubkeyMap.values())
            .slice(0, limit)
            .map((event) => ({
              pubkey: event.pubkey,
              relays: [url],
            }));
        }
      } catch (error) {
        // If this relay fails, try the next one
        console.warn(`NIP-50 search failed on relay ${url}:`, error);
        continue;
      }
    }

    // If no relay returned results, return empty array
    return [];
  }

  /** Check if the database backend supports features */
  async supports(): Promise<Features[]> {
    const supportedFeatures: Features[] = ["subscribe"]; // Always support subscriptions

    // Check if at least one relay supports NIP-50 search
    const searchRelays = await this.getSearchSupportingRelayUrls();
    if (searchRelays.length > 0) {
      supportedFeatures.push("search");
      supportedFeatures.push("lookup"); // NIP-50 search enables lookup
    }

    return supportedFeatures;
  }
}
