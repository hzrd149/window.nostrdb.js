import "./interface.js";
import { NostrDBConfig } from "./interface.js";

export type { IWindowNostrDB, NostrDBConfig } from "./interface.js";

const defaultConfig = {
  localRelays: ["ws://localhost:4869/"],
} satisfies NostrDBConfig;

const config: NostrDBConfig = (window.nostrdbConfig = {
  ...defaultConfig,
  ...window.nostrdbConfig,
} as NostrDBConfig);

if (typeof window !== "undefined" && window.nostrdb === undefined) {
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

    window.nostrdb = new LocalRelay(connectedRelays);
    console.log(
      `polyfilled window.nostrdb with ${connectedRelays.length} local relay${connectedRelays.length > 1 ? "s" : ""}`,
    );
  } else {
    // Failed to connect to any local relay, fallback to nostr-idb
    const { NostrIDBWrapper } = await import("./events/nostr-idb.js");

    window.nostrdb = new NostrIDBWrapper();
    console.log("polyfilled window.nostrdb with nostr-idb");
  }
}
