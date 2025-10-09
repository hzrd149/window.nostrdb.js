import {
  DEFAULT_PRIMAL_RELAY,
  type PrimalCache,
  type Vertex,
} from "applesauce-extra";
import "./interface.js";
import { IWindowNostrDB, NostrDBConfig } from "./interface.js";

const defaultConfig = {
  localRelay: "ws://localhost:4869/",
  primalUserLookup: true,
  vertexUserLookup: false,
  vertexMethod: "globalPagerank",
} satisfies NostrDBConfig;

const config = (window.nostrdbConfig = {
  ...defaultConfig,
  ...window.nostrdbConfig,
});

if (typeof window !== "undefined" && window.nostrdb === undefined) {
  let nostrdb: IWindowNostrDB;

  // Ensure a signer is provided when vertexUserLookup is true
  if (config.vertexUserLookup && !config.vertexSigner)
    throw new Error("Vertex signer is required when vertexUserLookup is true");

  // Create window.nostrdb polyfill
  try {
    const info = await fetch(config.localRelay.replace("ws", "http"), {
      headers: { Accept: "application/nostr+json" },
    });
    if (!info.ok) throw new Error("Failed to connect to local relay");

    const { LocalRelay } = await import("./local-relay.js");
    nostrdb = new LocalRelay(config.localRelay);
    console.log("polyfilled window.nostrdb with local relay");
  } catch (err) {
    // Failed to connect to local relay, fallback to nostr-idb
    const { NostrIDB } = await import("nostr-idb");

    // @ts-expect-error - lookup is not required in NostrIDB
    nostrdb = new NostrIDB();
    console.log("polyfilled window.nostrdb with nostr-idb");

    nostrdb.lookup = () =>
      Promise.reject(
        new Error("lookup is not supported for nostr-idb backend"),
      );
  }

  // Save copy of original lookup method
  const lookup = nostrdb.lookup.bind(nostrdb);

  // Override lookup method with primal and vertex lookup
  let vertex: Vertex | null = null;
  let primal: PrimalCache | null = null;
  nostrdb.lookup = async (search, limit) => {
    // If vertex is setup, use it for lookup
    if (config.vertexUserLookup && config.vertexSigner) {
      if (!vertex) {
        // Create vertex instance
        const { Vertex, VERTEX_RELAY } = await import("applesauce-extra");

        const signer = await config.vertexSigner();
        if (!signer) throw new Error("Vertex signer missing");
        vertex = new Vertex(signer, config.vertexRelay || VERTEX_RELAY);
      }

      return vertex.userSearch(search, config.vertexMethod, limit);
    } else if (config.primalUserLookup) {
      if (!primal) {
        const { PrimalCache } = await import("applesauce-extra");
        primal = new PrimalCache(config.primalCache || DEFAULT_PRIMAL_RELAY);
      }

      return (await primal.userSearch(search, limit)).map((e) => ({
        pubkey: e.pubkey,
        relays: [DEFAULT_PRIMAL_RELAY],
      }));
    }

    // Fallback to original lookup method
    return await lookup(search, limit);
  };

  // Save copy of original supports method
  const supports = nostrdb.supports.bind(nostrdb);

  // Override supports method with primal and vertex supports
  nostrdb.supports = async () => {
    const features = await supports();

    if (!features.includes("lookup")) {
      if (config.vertexUserLookup && config.vertexSigner) {
        features.push("lookup");
      } else if (config.primalUserLookup) {
        features.push("lookup");
      }
    }

    return features;
  };

  window.nostrdb = nostrdb;
}
