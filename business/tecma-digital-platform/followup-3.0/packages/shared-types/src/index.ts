export type WorkspaceRole = 'owner' | 'admin' | 'collaborator' | 'viewer';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    status: number;
    tId?: string;
    details?: Array<{ field: string; messageDetail: string[] }>;
  };
}

export interface PaginationInfo {
  totalDocs: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage?: number | null;
  nextPage?: number | null;
}

export interface ApiDataResponse<T> {
  data: T;
}

export interface ApiListResponse<T> {
  data: T[];
  paginationInfo: PaginationInfo;
}
