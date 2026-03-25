import { beforeEach, describe, expect, it, vi } from "vitest";

const lockoutStore = new Map<string, Record<string, unknown>>();

const findOne = vi.fn();
const insertOne = vi.fn();
const updateOne = vi.fn();
const deleteOne = vi.fn();

function wireCollectionMocks() {
  findOne.mockImplementation(async (q: { _id: string }) => {
    const d = lockoutStore.get(q._id);
    return d ? { ...d } : null;
  });
  insertOne.mockImplementation(async (doc: Record<string, unknown>) => {
    lockoutStore.set(String(doc._id), { ...doc });
    return { acknowledged: true };
  });
  updateOne.mockImplementation(
    async (filter: { _id: string }, update: { $set?: Record<string, unknown>; $unset?: Record<string, string> }) => {
      const id = filter._id;
      const cur = lockoutStore.get(id);
      if (!cur) return { acknowledged: true, matchedCount: 0 };
      if (update.$set) Object.assign(cur, update.$set);
      if (update.$unset) {
        for (const k of Object.keys(update.$unset)) delete cur[k];
      }
      lockoutStore.set(id, cur);
      return { acknowledged: true, matchedCount: 1 };
    }
  );
  deleteOne.mockImplementation(async (filter: { _id: string }) => {
    const ok = lockoutStore.delete(filter._id);
    return { acknowledged: true, deletedCount: ok ? 1 : 0 };
  });
}
wireCollectionMocks();

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({ findOne, insertOne, updateOne, deleteOne }),
  }),
}));

vi.mock("../../config/env.js", () => ({
  ENV: {
    AUTH_LOCKOUT_MAX_ATTEMPTS: 3,
    AUTH_LOCKOUT_WINDOW_MS: 60_000,
    AUTH_LOCKOUT_DURATION_MS: 120_000,
  },
}));

const loggerError = vi.fn();
vi.mock("../../observability/logger.js", () => ({
  logger: { error: loggerError },
}));

const observeSecurityAccountLockout = vi.fn();
vi.mock("../../observability/metrics.js", () => ({
  observeSecurityAccountLockout,
}));

describe("accountLockout.service", () => {
  beforeEach(() => {
    lockoutStore.clear();
    vi.clearAllMocks();
    wireCollectionMocks();
  });

  it("isEmailLocked: null se assente o senza lockedUntil", async () => {
    const { isEmailLocked } = await import("./accountLockout.service.js");
    expect(await isEmailLocked("a@b.it")).toBeNull();
    lockoutStore.set("a@b.it", { _id: "a@b.it", failedAttempts: 1, windowStart: new Date() });
    expect(await isEmailLocked("a@b.it")).toBeNull();
  });

  it("isEmailLocked: ritorna data se ancora bloccato", async () => {
    const { isEmailLocked } = await import("./accountLockout.service.js");
    const until = new Date(Date.now() + 60_000);
    lockoutStore.set("x@y.it", { _id: "x@y.it", failedAttempts: 3, windowStart: new Date(), lockedUntil: until });
    const got = await isEmailLocked("x@y.it");
    expect(got?.getTime()).toBe(until.getTime());
  });

  it("isEmailLocked: null se lockedUntil nel passato", async () => {
    const { isEmailLocked } = await import("./accountLockout.service.js");
    lockoutStore.set("old@y.it", {
      _id: "old@y.it",
      failedAttempts: 3,
      windowStart: new Date(),
      lockedUntil: new Date(Date.now() - 1000),
    });
    expect(await isEmailLocked("old@y.it")).toBeNull();
  });

  it("clearLockoutForEmail e catch su errore", async () => {
    const { clearLockoutForEmail } = await import("./accountLockout.service.js");
    lockoutStore.set("z@z.it", { _id: "z@z.it", failedAttempts: 1, windowStart: new Date() });
    await clearLockoutForEmail("z@z.it");
    expect(lockoutStore.has("z@z.it")).toBe(false);

    deleteOne.mockRejectedValueOnce(new Error("db down"));
    await clearLockoutForEmail("any@x.it");
    expect(loggerError).toHaveBeenCalled();
  });

  it("recordFailedPasswordAttempt: primo insert", async () => {
    const { recordFailedPasswordAttempt } = await import("./accountLockout.service.js");
    await recordFailedPasswordAttempt("n@n.it");
    expect(lockoutStore.get("n@n.it")).toMatchObject({ failedAttempts: 1 });
  });

  it("recordFailedPasswordAttempt: reset finestra", async () => {
    const { recordFailedPasswordAttempt } = await import("./accountLockout.service.js");
    const oldStart = new Date(Date.now() - 120_000);
    lockoutStore.set("w@w.it", { _id: "w@w.it", failedAttempts: 2, windowStart: oldStart });
    await recordFailedPasswordAttempt("w@w.it");
    const doc = lockoutStore.get("w@w.it")!;
    expect(doc.failedAttempts).toBe(1);
    expect(doc.lockedUntil).toBeUndefined();
  });

  it("recordFailedPasswordAttempt: incrementa sotto max", async () => {
    const { recordFailedPasswordAttempt } = await import("./accountLockout.service.js");
    lockoutStore.set("i@i.it", { _id: "i@i.it", failedAttempts: 1, windowStart: new Date() });
    await recordFailedPasswordAttempt("i@i.it");
    expect(lockoutStore.get("i@i.it")?.failedAttempts).toBe(2);
    expect(observeSecurityAccountLockout).not.toHaveBeenCalled();
  });

  it("recordFailedPasswordAttempt: lock a max e metrica", async () => {
    const { recordFailedPasswordAttempt } = await import("./accountLockout.service.js");
    lockoutStore.set("l@l.it", { _id: "l@l.it", failedAttempts: 2, windowStart: new Date() });
    await recordFailedPasswordAttempt("l@l.it");
    expect(lockoutStore.get("l@l.it")?.failedAttempts).toBe(3);
    expect(lockoutStore.get("l@l.it")?.lockedUntil).toBeInstanceOf(Date);
    expect(observeSecurityAccountLockout).toHaveBeenCalledOnce();
  });

  it("recordFailedPasswordAttempt: catch log", async () => {
    findOne.mockRejectedValueOnce(new Error("read fail"));
    const { recordFailedPasswordAttempt } = await import("./accountLockout.service.js");
    await recordFailedPasswordAttempt("e@e.it");
    expect(loggerError).toHaveBeenCalled();
  });
});
