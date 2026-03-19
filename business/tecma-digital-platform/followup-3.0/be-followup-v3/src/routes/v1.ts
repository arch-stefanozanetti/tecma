import { Router } from "express";
import { requireAuth } from "./authMiddleware.js";
import { accessLoggerMiddleware } from "./accessLoggerMiddleware.js";
import { publicRoutes } from "./v1/public.routes.js";
import { projectsRoutes } from "./v1/projects.routes.js";
import { connectorsRoutes } from "./v1/connectors.routes.js";
import { communicationsRoutes } from "./v1/communications.routes.js";
import { authRoutes } from "./v1/auth.routes.js";
import { calendarRoutes } from "./v1/calendar.routes.js";
import { clientsRoutes } from "./v1/clients.routes.js";
import { requestsRoutes } from "./v1/requests.routes.js";
import { sessionRoutes } from "./v1/session.routes.js";
import { notificationsRoutes } from "./v1/notifications.routes.js";
import { automationRulesRoutes } from "./v1/automation-rules.routes.js";
import { apartmentsRoutes } from "./v1/apartments.routes.js";
import { futureRoutes } from "./v1/future.routes.js";
import { matchingRoutes } from "./v1/matching.routes.js";
import { usersRoutes } from "./v1/users.routes.js";
import { emailFlowsRoutes } from "./v1/email-flows.routes.js";
import { workspacesRoutes } from "./v1/workspaces.routes.js";
import { assetsRoutes } from "./v1/assets.routes.js";
import { clientDocumentsRoutes } from "./v1/client-documents.routes.js";
import { additionalInfosRoutes } from "./v1/additional-infos.routes.js";
import { workflowRoutes } from "./v1/workflow.routes.js";
import { productDiscoveryRoutes } from "./v1/product-discovery.routes.js";
import { opsRoutes } from "./v1/ops.routes.js";

export const v1Router = Router();

v1Router.use(accessLoggerMiddleware);
v1Router.use("/", publicRoutes);

// Protected routes (require valid JWT)
v1Router.use(requireAuth);

v1Router.use("/", projectsRoutes);
v1Router.use("/", connectorsRoutes);
v1Router.use("/", communicationsRoutes);
v1Router.use("/", authRoutes);
v1Router.use("/", calendarRoutes);
v1Router.use("/", clientsRoutes);
v1Router.use("/", requestsRoutes);
v1Router.use("/", sessionRoutes);
v1Router.use("/", notificationsRoutes);
v1Router.use("/", automationRulesRoutes);
v1Router.use("/", apartmentsRoutes);
v1Router.use("/", futureRoutes);
v1Router.use("/", matchingRoutes);
v1Router.use("/", usersRoutes);
v1Router.use("/", emailFlowsRoutes);
v1Router.use("/", assetsRoutes);
v1Router.use("/", clientDocumentsRoutes);
v1Router.use("/", workspacesRoutes);
v1Router.use("/", additionalInfosRoutes);
v1Router.use("/", workflowRoutes);
v1Router.use("/", productDiscoveryRoutes);
v1Router.use("/", opsRoutes);
