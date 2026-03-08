import type { Request, Response, RequestHandler } from "express";

const statusCodeFromError = (error: unknown): number =>
  typeof error === "object" && error !== null && "statusCode" in error
    ? Number((error as { statusCode: number }).statusCode)
    : 400;

const messageFromError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error)
    return String((error as { message: unknown }).message);
  return String(error);
};

/**
 * Sends error response with status from error.statusCode (e.g. HttpError) or 400.
 */
export const sendError = (res: Response, error: unknown): void => {
  const statusCode = statusCodeFromError(error);
  const message = messageFromError(error);
  res.status(statusCode).json({ error: message });
};

/**
 * Wraps an async handler: on success sends JSON body (if not undefined); on throw calls sendError.
 * Use for all routes that return a single JSON body and throw on validation/business errors.
 */
export const handleAsync = (
  handler: (req: Request) => Promise<unknown>
): RequestHandler => {
  return (req: Request, res: Response) =>
    handler(req)
      .then((payload) => {
        if (payload !== undefined) res.json(payload);
      })
      .catch((err) => sendError(res, err));
};
