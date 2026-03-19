import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "../../test-utils";
import { InboxPage } from "./InboxPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    getNotifications: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0, page: 1, perPage: 25, totalPages: 0 } }),
    subscribeRealtimeEvents: vi.fn().mockReturnValue(vi.fn()),
    markNotificationRead: vi.fn().mockResolvedValue(undefined),
    markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("InboxPage", () => {
  const onSectionChange = vi.fn();
  const navigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina senza crash", () => {
    const { container } = render(
      <InboxPage workspaceId="w1" onSectionChange={onSectionChange} navigate={navigate} />
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
