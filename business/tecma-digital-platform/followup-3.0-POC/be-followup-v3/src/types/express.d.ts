import type { AccessTokenPayload } from "../core/auth/token.service.js";
import type { PlatformAccessContext } from "../routes/platformApiKeyMiddleware.js";

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
      platformAccess?: PlatformAccessContext;
    }
  }
}

export {};
