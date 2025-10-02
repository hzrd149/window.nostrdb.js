import { IndexedDBNostrDB } from "./nostrdb-idb.js";

export * from "./interface.js";
export * from "./nostrdb-idb.js";

if (typeof window !== "undefined" && !("nostrdb" in window)) {
  // @ts-expect-error
  window.nostrdb = new IndexedDBNostrDB();
  console.log("polyfilled window.nostrdb");
}
