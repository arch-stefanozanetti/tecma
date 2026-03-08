import type { AccessTokenPayload } from "../core/auth/token.service.js";

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export {};
