import "./interface.js";
import { NostrIDB } from "nostr-idb";

if (typeof window !== "undefined" && !("nostrdb" in window)) {
  // @ts-expect-error
  window.nostrdb = new NostrIDB();
  console.log("polyfilled window.nostrdb");
}
