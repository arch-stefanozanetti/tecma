import type { FastifyReply } from 'fastify';

export type ApiErrorDetail = {
  field?: string;
  value?: unknown;
  messageDetail: string[];
};

export type ApiErrorResponseBody = {
  error: {
    code: string;
    message: string;
    status: number;
    traceId?: string;
    details?: ApiErrorDetail[];
  };
};

export class ApiError extends Error {
  readonly code: string;

  readonly status: number;

  readonly details?: ApiErrorDetail[];

  constructor(input: {
    code: string;
    message: string;
    status: number;
    details?: ApiErrorDetail[];
  }) {
    super(input.message);
    this.name = 'ApiError';
    this.code = input.code;
    this.status = input.status;
    if (input.details !== undefined) this.details = input.details;
  }
}

export const apiErrorBody = (error: ApiError, traceId?: string): ApiErrorResponseBody => ({
  error: {
    code: error.code,
    message: error.message,
    status: error.status,
    ...(traceId != null ? { traceId } : {}),
    ...(error.details != null ? { details: error.details } : {}),
  },
});

export const sendApiError = (
  reply: FastifyReply,
  input: ApiError | { code: string; message: string; status: number; details?: ApiErrorDetail[] },
  traceId?: string,
): void => {
  const error = input instanceof ApiError ? input : new ApiError(input);
  reply.status(error.status).send(apiErrorBody(error, traceId));
};

export const badRequest = (message: string, details?: ApiErrorDetail[]): ApiError =>
  new ApiError({
    code: 'BadRequest',
    message,
    status: 400,
    ...(details != null ? { details } : {}),
  });

export const unauthorized = (message = 'Not authenticated'): ApiError =>
  new ApiError({ code: 'Unauthorized', message, status: 401 });

export const forbidden = (message = 'Forbidden'): ApiError =>
  new ApiError({ code: 'Forbidden', message, status: 403 });

export const notFound = (message = 'Not found'): ApiError =>
  new ApiError({ code: 'NotFound', message, status: 404 });

export const conflict = (message: string): ApiError =>
  new ApiError({ code: 'Conflict', message, status: 409 });
