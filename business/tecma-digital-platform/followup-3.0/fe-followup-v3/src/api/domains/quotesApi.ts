import { postJson } from "../http";
import type { ListQuery, PaginatedResponse, QuoteListRow } from "../../types/domain";

export const quotesApi = {
  queryQuotes: (query: ListQuery) =>
    postJson<PaginatedResponse<QuoteListRow>>("/quotes/query", query),
};
