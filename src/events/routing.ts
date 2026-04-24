import type { NostrEvent } from "applesauce-core/helpers/event";
import type { Filter } from "applesauce-core/helpers/filter";
import type {
  IWindowNostrDB,
  IWindowNostrDBPolyfill,
  NostrDBConfig,
} from "../interface.js";

const AVAILABILITY_TTL_MS = 60_000;
const AVAILABILITY_TIMEOUT_MS = 1_500;

/**
 * Routes each request to either a LocalRelay backend (when configured local
 * relays are reachable) or a NostrIDBWrapper fallback. Availability is
 * probed lazily on demand and cached briefly; no connections are made at
 * construction time.
 */
export class RoutingBackend implements IWindowNostrDBPolyfill {
  private localRelayUrls: string[];
  private idbBackend: IWindowNostrDB | null = null;
  private localBackend: IWindowNostrDB | null = null;
  private availability: { ok: boolean; checkedAt: number } | null = null;
  private probeInFlight: Promise<boolean> | null = null;
  private configVersion = 0;

  constructor(config: NostrDBConfig) {
    this.localRelayUrls = [...config.localRelays];
  }

  configure(config: Partial<NostrDBConfig>): void {
    if (config.localRelays === undefined) return;

    this.localRelayUrls = [...config.localRelays];
    this.localBackend = null;
    this.availability = null;
    this.probeInFlight = null;
    this.configVersion += 1;
  }

  private async getIdb(): Promise<IWindowNostrDB> {
    if (!this.idbBackend) {
      const { NostrIDBWrapper } = await import("./nostr-idb.js");
      this.idbBackend = new NostrIDBWrapper();
    }
    return this.idbBackend;
  }

  private async getLocal(): Promise<IWindowNostrDB> {
    if (!this.localBackend) {
      const localRelayUrls = [...this.localRelayUrls];
      const configVersion = this.configVersion;
      const { LocalRelay } = await import("./local-relay.js");
      const localBackend = new LocalRelay(localRelayUrls);
      if (configVersion === this.configVersion) {
        this.localBackend = localBackend;
      }
      return localBackend;
    }
    return this.localBackend;
  }

  private isFresh(): boolean {
    if (!this.availability) return false;
    return Date.now() - this.availability.checkedAt < AVAILABILITY_TTL_MS;
  }

  private probeAvailability(): Promise<boolean> {
    if (this.probeInFlight) return this.probeInFlight;

    const localRelayUrls = [...this.localRelayUrls];
    const configVersion = this.configVersion;
    const probe = (async () => {
      const results = await Promise.all(
        localRelayUrls.map(async (url) => {
          const controller = new AbortController();
          const timeout = setTimeout(
            () => controller.abort(),
            AVAILABILITY_TIMEOUT_MS,
          );

          try {
            const res = await fetch(url.replace(/^ws/, "http"), {
              headers: { Accept: "application/nostr+json" },
              signal: controller.signal,
            });
            return res.ok;
          } catch {
            return false;
          } finally {
            clearTimeout(timeout);
          }
        }),
      );
      const ok = results.some(Boolean);
      if (configVersion === this.configVersion) {
        this.availability = { ok, checkedAt: Date.now() };
      }
      return ok;
    })();

    let trackedProbe: Promise<boolean>;
    trackedProbe = probe.finally(() => {
      if (this.probeInFlight === trackedProbe) this.probeInFlight = null;
    });

    this.probeInFlight = trackedProbe;
    return this.probeInFlight;
  }

  private async pickBackend(): Promise<IWindowNostrDB> {
    if (this.localRelayUrls.length === 0) return await this.getIdb();
    if (!this.isFresh()) await this.probeAvailability();
    return this.availability?.ok ? await this.getLocal() : await this.getIdb();
  }

  async add(event: NostrEvent): Promise<boolean> {
    return (await this.pickBackend()).add(event);
  }

  async event(id: string): Promise<NostrEvent | undefined> {
    return (await this.pickBackend()).event(id);
  }

  async replaceable(
    kind: number,
    author: string,
    identifier?: string,
  ): Promise<NostrEvent | undefined> {
    return (await this.pickBackend()).replaceable(kind, author, identifier);
  }

  async count(filters: Filter | Filter[]): Promise<number> {
    return (await this.pickBackend()).count(filters);
  }

  async supports(): Promise<string[]> {
    return (await this.pickBackend()).supports();
  }

  async query(filters: Filter | Filter[]): Promise<NostrEvent[]> {
    return (await this.pickBackend()).query(filters);
  }

  async *subscribe(filters: Filter | Filter[]): AsyncGenerator<NostrEvent> {
    const backend = await this.pickBackend();
    yield* backend.subscribe(filters);
  }
}
