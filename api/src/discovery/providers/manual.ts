import type { SearchHit, SearchProvider, SearchProviderContext } from "../types.js";

/**
 * Manual/seed provider — returns hits supplied via run config `seedHits`.
 * Used to ingest known public business URLs without a search API.
 */
export class ManualSearchProvider implements SearchProvider {
  readonly name = "manual";

  constructor(private readonly seedHits: SearchHit[] = []) {}

  async search(_ctx: SearchProviderContext): Promise<SearchHit[]> {
    return this.seedHits;
  }
}
