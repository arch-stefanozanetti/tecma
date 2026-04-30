/** Error with HTTP status for route handlers; use so sendError can set res.status(statusCode). */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code?: string,
    public readonly hint?: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export type SortDirection = 1 | -1;

export interface ListQuery {
  workspaceId: string;
  projectIds: string[];
  page?: number;
  perPage?: number;
  searchText?: string;
  sort?: {
    field: string;
    direction: SortDirection;
  };
  filters?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}
