import type { ProfilePointer } from "nostr-tools/nip19";
import "./interface.js";
import { IWindowNostrDB, NostrDBConfig } from "./interface.js";
import { primalLookup } from "./lookup/primal.js";
import { lookupRelatr } from "./lookup/relatr.js";
import { vertexLookup } from "./lookup/vertex.js";

export type { Features, IWindowNostrDB, NostrDBConfig } from "./interface.js";

const defaultConfig = {
  localRelays: ["ws://localhost:4869/"],
  primal: {},
  vertex: {
    method: "globalPagerank",
  },
  relatr: {
    pubkey: "750682303c9f0ddad75941b49edc9d46e3ed306b9ee3335338a21a3e404c5fa3",
    relays: ["wss://relay.contextvm.org"],
  },
  lookupProviders: ["primal", "relatr", "local"],
} satisfies NostrDBConfig;

const config: NostrDBConfig = (window.nostrdbConfig = {
  ...defaultConfig,
  ...window.nostrdbConfig,
} as NostrDBConfig);

if (typeof window !== "undefined" && window.nostrdb === undefined) {
  let nostrdb: IWindowNostrDB;

  // Create window.nostrdb polyfill
  // Try to connect to local relays in parallel
  const relayPromises = config.localRelays.map(async (url) => {
    try {
      const info = await fetch(url.replace("ws", "http"), {
        headers: { Accept: "application/nostr+json" },
      });
      if (!info.ok) throw new Error("Failed to connect to local relay");
      return url;
    } catch {
      return null;
    }
  });

  const connectedRelays = (await Promise.all(relayPromises)).filter(
    (url): url is string => url !== null,
  );

  if (connectedRelays.length > 0) {
    // At least one local relay is available
    const { LocalRelay } = await import("./events/local-relay.js");

    // Pass all connected relays to LocalRelay for parallel operation
    nostrdb = new LocalRelay(connectedRelays);
    console.log(
      `polyfilled window.nostrdb with ${connectedRelays.length} local relay${connectedRelays.length > 1 ? "s" : ""}`,
    );
  } else {
    // Failed to connect to any local relay, fallback to nostr-idb
    const { NostrIDBWrapper } = await import("./events/nostr-idb.js");

    nostrdb = new NostrIDBWrapper();
    console.log("polyfilled window.nostrdb with nostr-idb");
  }

  // Save copy of original lookup method
  const originalLookup = nostrdb.lookup.bind(nostrdb);

  // Override lookup method with lookup provider orchestration
  nostrdb.lookup = async (
    search: string,
    limit?: number,
  ): Promise<ProfilePointer[]> => {
    // Try each provider in the order specified
    for (const provider of config.lookupProviders) {
      try {
        switch (provider) {
          case "vertex":
            // Check if vertex is configured
            if (!config.vertex) {
              console.warn(
                'Lookup provider "vertex" is enabled but not configured. Skipping.',
              );
              break;
            }
            // Only try vertex if signer is configured
            if (config.vertex.signer) {
              return await vertexLookup(search, config, limit);
            }
            break;

          case "primal":
            // Check if primal is configured
            if (!config.primal) {
              console.warn(
                'Lookup provider "primal" is enabled but not configured. Skipping.',
              );
              break;
            }
            return await primalLookup(search, config, limit);

          case "relatr":
            // Check if relatr is configured
            if (!config.relatr) {
              console.warn(
                'Lookup provider "relatr" is enabled but not configured. Skipping.',
              );
              break;
            }
            // Only try relatr if pubkey and relays are configured
            if (config.relatr.pubkey && config.relatr.relays.length > 0) {
              return await lookupRelatr(search, config, limit);
            }
            break;

          case "local":
            // Use the original lookup method from LocalRelay or NostrIDB
            return await originalLookup(search, limit);
        }
      } catch (error) {
        // If this provider fails, try the next one
        console.warn(`Lookup provider "${provider}" failed:`, error);
        continue;
      }
    }

    // If all providers fail or none are configured, throw an error
    throw new Error("All lookup providers failed or none are configured");
  };

  // Save copy of original supports method
  const supports = nostrdb.supports.bind(nostrdb);

  // Override supports method to include lookup if any providers are configured
  nostrdb.supports = async () => {
    const features = await supports();

    if (!features.includes("lookup") && config.lookupProviders.length > 0)
      features.push("lookup");

    return features;
  };

  window.nostrdb = nostrdb;
}
