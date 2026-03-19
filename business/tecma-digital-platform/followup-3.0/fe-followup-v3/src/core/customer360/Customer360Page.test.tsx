import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "../../test-utils";
import { Customer360Page } from "./Customer360Page";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    clients: { queryClients: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }) },
    queryCalendar: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    queryRequests: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    getNotifications: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
  },
}));

describe("Customer360Page", () => {
  const onSectionChange = vi.fn();
  const navigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina senza crash", async () => {
    const { container } = render(
      <Customer360Page
        workspaceId="w1"
        projectIds={["p1"]}
        onSectionChange={onSectionChange}
        navigate={navigate}
      />
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
