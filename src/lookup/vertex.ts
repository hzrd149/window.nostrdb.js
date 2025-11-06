import type { Vertex } from "applesauce-extra";
import type { ProfilePointer } from "nostr-tools/nip19";
import type { NostrDBConfig } from "../interface.js";

let vertex: Vertex | null = null;

/**
 * Lookup users using Vertex
 */
export async function vertexLookup(
  search: string,
  config: NostrDBConfig,
  limit?: number,
): Promise<ProfilePointer[]> {
  if (!vertex) {
    // Create vertex instance
    const { Vertex, VERTEX_RELAY } = await import("applesauce-extra");

    if (!config.vertex?.signer) {
      throw new Error("Vertex signer is required for vertex lookup");
    }

    const signer = await config.vertex.signer();
    if (!signer) throw new Error("Vertex signer missing");
    vertex = new Vertex(signer, config.vertex.relay || VERTEX_RELAY);
  }

  return vertex.userSearch(
    search,
    config.vertex?.method || "globalPagerank",
    limit,
  );
}
