import { z } from 'zod';

export const PAGINATION_DEFAULT_PAGE = 1;
export const PAGINATION_DEFAULT_PER_PAGE = 20;
export const PAGINATION_MAX_PER_PAGE = 100;

export interface PaginationParams {
  page: number;
  perPage: number;
  sortField?: string;
  sortOrder: 'asc' | 'desc';
}

export interface PaginationInfo {
  totalDocs: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
}

/**
 * Schema Zod riusabile per il querystring di paginazione.
 * Chi consuma questo helper passa la lista dei `sortField` ammessi
 * (es. ['email', 'createdAt', 'updatedAt']) per evitare iniezione di
 * field sort arbitrari nel `sort` Mongo.
 */
export const buildPaginationQuerySchema = (allowedSortFields: readonly string[]) =>
  z
    .object({
      page: z.coerce.number().int().min(1).default(PAGINATION_DEFAULT_PAGE),
      perPage: z.coerce
        .number()
        .int()
        .min(1)
        .max(PAGINATION_MAX_PER_PAGE)
        .default(PAGINATION_DEFAULT_PER_PAGE),
      sortField:
        allowedSortFields.length === 0
          ? z.never().optional()
          : z.enum(allowedSortFields as [string, ...string[]]).optional(),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    })
    .strict();

export const parsePaginationQuery = (
  query: unknown,
  allowedSortFields: readonly string[],
): PaginationParams => {
  const parsed = buildPaginationQuerySchema(allowedSortFields).parse(query ?? {});
  return {
    page: parsed.page,
    perPage: parsed.perPage,
    sortField: parsed.sortField,
    sortOrder: parsed.sortOrder,
  };
};

export const buildPaginationInfo = (
  totalDocs: number,
  params: PaginationParams,
): PaginationInfo => {
  const totalPages = totalDocs <= 0 ? 0 : Math.ceil(totalDocs / params.perPage);
  const page = params.page;
  const hasPrevPage = page > 1 && totalPages > 0;
  const hasNextPage = page < totalPages;
  return {
    totalDocs: totalDocs < 0 ? 0 : totalDocs,
    page,
    perPage: params.perPage,
    totalPages,
    hasPrevPage,
    hasNextPage,
    prevPage: hasPrevPage ? page - 1 : null,
    nextPage: hasNextPage ? page + 1 : null,
  };
};

/** Helper per costruire il `sort` di Mongo dai PaginationParams (tie-break stabile su _id). */
export const buildMongoSort = (
  params: PaginationParams,
  defaultSortField: string,
): Record<string, 1 | -1> => {
  const field = params.sortField ?? defaultSortField;
  const order = params.sortOrder === 'asc' ? 1 : -1;
  // Tie-break stabile su _id per evitare scivolamenti di pagina su valori uguali.
  if (field === '_id') return { _id: order };
  return { [field]: order, _id: order };
};

/** Skip Mongo dato page/perPage 1-based. */
export const buildMongoSkip = (params: PaginationParams): number => {
  return (params.page - 1) * params.perPage;
};
