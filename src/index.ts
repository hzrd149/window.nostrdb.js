import "./interface.js";
import type { NostrDBConfig } from "./interface.js";
import { RoutingBackend } from "./events/routing.js";

export type {
  IWindowNostrDB,
  IWindowNostrDBPolyfill,
  NostrDBConfig,
} from "./interface.js";

const defaultConfig: NostrDBConfig = {
  localRelays: [],
};

if (typeof window !== "undefined") {
  const config: NostrDBConfig = (window.nostrdbConfig = {
    ...defaultConfig,
    ...window.nostrdbConfig,
  } as NostrDBConfig);

  if (window.nostrdb === undefined) {
    window.nostrdb = new RoutingBackend(config);
    if (config.localRelays.length > 0) {
      console.log(
        `polyfilled window.nostrdb with routing backend (${config.localRelays.length} local relay${config.localRelays.length > 1 ? "s" : ""} configured, nostr-idb fallback)`,
      );
    } else {
      console.log("polyfilled window.nostrdb with nostr-idb backend");
    }
  }
}
