import { AppError } from "../../lib/errors.js";
import type { SearchHit, SearchProvider } from "../types.js";
import { ManualSearchProvider } from "./manual.js";
import { MockSearchProvider } from "./mock.js";

export function getSearchProvider(
  name: string,
  opts?: { seedHits?: SearchHit[] },
): SearchProvider {
  switch (name) {
    case "mock":
      return new MockSearchProvider();
    case "manual":
      return new ManualSearchProvider(opts?.seedHits ?? []);
    default:
      throw new AppError(
        400,
        `Unknown discovery provider '${name}'. Supported: mock, manual. Plug in Places/Bing via SearchProvider interface.`,
        "UNKNOWN_PROVIDER",
      );
  }
}

export { MockSearchProvider, ManualSearchProvider };
