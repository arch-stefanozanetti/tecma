import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "../../test-utils";
import { IntegrationsPage } from "./IntegrationsPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    listWebhookConfigs: vi.fn().mockResolvedValue({ data: [] }),
    getN8nConfig: vi.fn().mockResolvedValue(null),
    getOutlookStatus: vi.fn().mockResolvedValue({ connected: false }),
    getWhatsAppConfig: vi.fn().mockResolvedValue({ config: null }),
    getMetaWhatsAppConfig: vi.fn().mockResolvedValue({ config: null }),
    getMailchimpConnectorConfig: vi.fn().mockResolvedValue({ config: null }),
    getActiveCampaignConnectorConfig: vi.fn().mockResolvedValue({ config: null }),
    getStripeConnectorConfig: vi.fn().mockResolvedValue({ config: null }),
    getPayPalConnectorConfig: vi.fn().mockResolvedValue({ config: null }),
    getWebflowConnectorConfig: vi.fn().mockResolvedValue({ config: null }),
    getTeamsIncomingConnectorConfig: vi.fn().mockResolvedValue({ config: null }),
    getWorkspaceAiConfig: vi.fn().mockResolvedValue({ configured: false, provider: null }),
    getSumsubConnectorConfig: vi.fn().mockResolvedValue({
      config: null,
      webhookPathTemplate: "/v1/webhooks/sumsub/:workspaceId",
    }),
    getMarketingMetaAdsConnectorConfig: vi.fn().mockResolvedValue({ config: null }),
    getMarketingGa4ConnectorConfig: vi.fn().mockResolvedValue({ config: null }),
    getMarketingGoogleAdsConnectorConfig: vi.fn().mockResolvedValue({ config: null }),
    saveMarketingMetaAdsConnectorConfig: vi.fn().mockResolvedValue({ config: {} }),
    saveMarketingGa4ConnectorConfig: vi.fn().mockResolvedValue({ config: {} }),
    saveMarketingGoogleAdsConnectorConfig: vi.fn().mockResolvedValue({ config: {} }),
    deleteMarketingMetaAdsConnectorConfig: vi.fn().mockResolvedValue({ deleted: true }),
    deleteMarketingGa4ConnectorConfig: vi.fn().mockResolvedValue({ deleted: true }),
    deleteMarketingGoogleAdsConnectorConfig: vi.fn().mockResolvedValue({ deleted: true }),
    getWorkspaceEntitlements: vi.fn().mockResolvedValue({
      data: [
        { feature: "publicApi", entitled: true, recordedStatus: null, implicit: true, recordedNotes: null },
        { feature: "twilio", entitled: true, recordedStatus: null, implicit: true, recordedNotes: null },
        { feature: "mailchimp", entitled: true, recordedStatus: null, implicit: true, recordedNotes: null },
        { feature: "activecampaign", entitled: true, recordedStatus: null, implicit: true, recordedNotes: null },
      ],
    }),
    listCommunicationTemplates: vi.fn().mockResolvedValue({ data: [] }),
    listCommunicationRules: vi.fn().mockResolvedValue({ data: [] }),
    listCommunicationDeliveries: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: vi.fn(() => ({
    workspaceId: "w1",
    isAdmin: false,
    selectedProjectIds: ["p1"],
    projects: [],
    hasPermission: () => true,
  })),
}));

describe("IntegrationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina senza crash", () => {
    const { container } = render(<IntegrationsPage workspaceId="w1" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("tab Comunicazioni: CTA setup Twilio e Meta se WhatsApp non configurato", async () => {
    function RouterComunicazioni({ children }: { children: ReactNode }) {
      return <MemoryRouter initialEntries={["/integrations?tab=comunicazioni"]}>{children}</MemoryRouter>;
    }
    render(<IntegrationsPage workspaceId="w1" />, { wrapper: RouterComunicazioni });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Apri setup Twilio/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Apri setup Meta/i })).toBeInTheDocument();
    });
  });
});
