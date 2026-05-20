"use server";

import { globalSearch, type SearchResult } from "@/server/services/search";

export async function globalSearchAction(query: string): Promise<SearchResult[]> {
  return globalSearch(query);
}
