import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ENV } from "../../config/env.js";
import {
  getEmailMockOutbox,
  resetEmailMockOutbox,
  sendInviteEmail,
  sendPasswordResetEmail
} from "./email.service.js";

afterEach(() => {
  resetEmailMockOutbox();
});

const originalTransport = ENV.EMAIL_TRANSPORT;
const originalAppEnv = ENV.APP_ENV;

beforeAll(() => {
  ENV.EMAIL_TRANSPORT = "mock";
  ENV.APP_ENV = "test";
});

afterAll(() => {
  ENV.EMAIL_TRANSPORT = originalTransport;
  ENV.APP_ENV = originalAppEnv;
});

describe("email.service (mock)", () => {
  it("records invite email in outbox", async () => {
    await sendInviteEmail({
      to: "u@example.com",
      token: "abc",
      projectName: "P1",
      roleLabel: "Agent",
      appPublicBaseUrl: "http://localhost:5177"
    });
    const out = getEmailMockOutbox();
    expect(out).toHaveLength(1);
    expect(out[0].to).toBe("u@example.com");
    expect(out[0].kind).toBe("invite");
    expect(out[0].html).toContain("token=abc");
  });

  it("records password reset in outbox", async () => {
    await sendPasswordResetEmail({ to: "x@example.com", token: "rst" });
    expect(getEmailMockOutbox()[0].kind).toBe("password_reset");
  });
});
