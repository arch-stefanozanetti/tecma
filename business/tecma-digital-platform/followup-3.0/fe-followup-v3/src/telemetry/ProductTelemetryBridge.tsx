import { useEffect, useRef } from "react";
import type { Section } from "../core/config/routes";
import { initProductTelemetry } from "./initPosthog";
import { trackProductEvent } from "./trackProductEvent";

type Props = {
  pathname: string;
  effectiveSection: Section;
  workspaceId: string;
};

/**
 * Init PostHog + eventi globali `app.session.start` e `app.route.view`.
 */
export function ProductTelemetryBridge({ pathname, effectiveSection, workspaceId }: Props) {
  const sessionSent = useRef(false);
  const prevSectionRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    initProductTelemetry();
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    if (sessionSent.current) return;
    sessionSent.current = true;
    trackProductEvent("app.session.start", {
      app_version: import.meta.env.VITE_APP_VERSION ?? "0",
      workspace_id: workspaceId,
    });
  }, [workspaceId]);

  useEffect(() => {
    const routePath = pathname.split("?")[0] || "/";
    trackProductEvent("app.route.view", {
      section: effectiveSection,
      route_path: routePath,
      previous_section: prevSectionRef.current,
      workspace_id: workspaceId || undefined,
    });
    prevSectionRef.current = effectiveSection;
  }, [pathname, effectiveSection, workspaceId]);

  return null;
}
