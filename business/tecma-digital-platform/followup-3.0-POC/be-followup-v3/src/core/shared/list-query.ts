import { z } from "zod";
import { MAX_LIST_SEARCH_TEXT_LENGTH } from "./searchTextRegex.js";

export const ListQuerySchema = z.object({
  workspaceId: z.string().min(1),
  projectIds: z.array(z.string().min(1)).min(1),
  /** Client esterni / form a volte inviano numeri come stringhe JSON. */
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(25),
  searchText: z.preprocess((v: unknown) => {
    if (v === undefined || v === null || v === "") return undefined;
    const s = String(v).trim().slice(0, MAX_LIST_SEARCH_TEXT_LENGTH);
    return s === "" ? undefined : s;
  }, z.string().optional()),
  sort: z
    .object({
      field: z.string(),
      /** Client / JSON a volte inviano 1 | -1 come stringhe ("1", "-1"). */
      direction: z.coerce
        .number()
        .refine((n) => n === 1 || n === -1, { message: "sort.direction must be 1 or -1" }),
    })
    .optional(),
  filters: z.record(z.unknown()).optional()
});

export type ListQueryInput = z.infer<typeof ListQuerySchema>;

export const buildPagination = (page: number, perPage: number) => ({
  skip: (page - 1) * perPage,
  limit: perPage
});
