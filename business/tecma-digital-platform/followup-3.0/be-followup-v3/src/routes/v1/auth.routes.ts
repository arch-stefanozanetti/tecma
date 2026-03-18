import { Router } from "express";
import { handleAsync } from "../asyncHandler.js";

export const authRoutes = Router();

authRoutes.get("/auth/me", handleAsync((req) => {
  const payload = req.user!;
  return Promise.resolve({
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    isAdmin: payload.isAdmin,
    permissions: payload.permissions,
    projectId: payload.projectId,
  });
}));
