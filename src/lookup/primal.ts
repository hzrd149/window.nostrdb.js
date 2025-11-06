import { DEFAULT_PRIMAL_RELAY, type PrimalCache } from "applesauce-extra";
import type { ProfilePointer } from "nostr-tools/nip19";
import type { NostrDBConfig } from "../interface.js";

let primal: PrimalCache | null = null;

/**
 * Lookup users using Primal cache
 */
export async function primalLookup(
  search: string,
  config: NostrDBConfig,
  limit?: number,
): Promise<ProfilePointer[]> {
  if (!primal) {
    const { PrimalCache } = await import("applesauce-extra");
    primal = new PrimalCache(config.primal?.cache || DEFAULT_PRIMAL_RELAY);
  }

  return (await primal.userSearch(search, limit)).map((e) => ({
    pubkey: e.pubkey,
    relays: [config.primal?.cache || DEFAULT_PRIMAL_RELAY],
  }));
}
