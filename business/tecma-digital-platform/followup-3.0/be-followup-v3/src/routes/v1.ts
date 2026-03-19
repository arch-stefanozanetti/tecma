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
import { hcRoutes } from "./v1/hc.routes.js";
import { usersAdminRoutes } from "./v1/users-admin.routes.js";
import { emailFlowsRoutes } from "./v1/email-flows.routes.js";
import { workspacesRoutes } from "./v1/workspaces.routes.js";
import { discoveryWorkflowRoutes } from "./v1/discovery-workflow.routes.js";
import { intelligenceRoutes } from "./v1/intelligence.routes.js";
import { realtimeRoutes } from "./v1/realtime.routes.js";
import { platformRoutes } from "./v1/platform.routes.js";
import { privacyRoutes } from "./v1/privacy.routes.js";
import { contractsRoutes } from "./v1/contracts.routes.js";
import { marketingAutomationRoutes } from "./v1/marketing-automation.routes.js";
import { mlsFeedPublicRoutes, mlsFeedRoutes } from "./v1/mls-feed.routes.js";
import { scaleOutRoutes } from "./v1/scale-out.routes.js";

export const v1Router = Router();

v1Router.use(accessLoggerMiddleware);
v1Router.use("/", publicRoutes);
v1Router.use("/platform", platformRoutes);
v1Router.use("/", realtimeRoutes);
v1Router.use("/", mlsFeedPublicRoutes);

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

// Domain modules extracted from legacy v1.ts monolith
v1Router.use("/", hcRoutes);
v1Router.use("/", usersAdminRoutes);
v1Router.use("/", emailFlowsRoutes);
v1Router.use("/", workspacesRoutes);
v1Router.use("/", discoveryWorkflowRoutes);
v1Router.use("/", intelligenceRoutes);
v1Router.use("/", privacyRoutes);
v1Router.use("/", contractsRoutes);
v1Router.use("/", marketingAutomationRoutes);
v1Router.use("/", mlsFeedRoutes);
v1Router.use("/", scaleOutRoutes);
