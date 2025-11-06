import type { ProfilePointer } from "nostr-tools/nip19";
import { NostrDBConfig } from "../interface.js";

/** Lookup users using Relatr server */
export async function lookupRelatr(
  search: string,
  config: NostrDBConfig,
  limit?: number,
): Promise<ProfilePointer[]> {
  const { RelatrClient } = await import("../ctxcn/RelatrClient.js");
  const relatr = new RelatrClient({
    serverPubkey: config.relatr?.pubkey,
    relays: config.relatr?.relays,
  });
  const result = await relatr.SearchProfiles(search, limit);

  return result.results.map((r) => ({
    pubkey: r.pubkey,
  }));
}
