import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validatePublicUrl, isServerTestFixtureAllowed } from "../../src/lib/import/url-security";

describe("SSRF Security Correction & Loopback Hardening", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("strictly blocks localhost when server test environment flag is not enabled", async () => {
    delete process.env.PROOF_UI_ENABLE_TEST_FIXTURES;
    Object.defineProperty(process.env, "NODE_ENV", { value: "development", configurable: true });

    const res = await validatePublicUrl("http://localhost/api/fixtures");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("PRIVATE_NETWORK");
    }
  });

  it("completely ignores client-supplied allowLoopbackForTesting or similar bypass property", async () => {
    delete process.env.PROOF_UI_ENABLE_TEST_FIXTURES;
    Object.defineProperty(process.env, "NODE_ENV", { value: "development", configurable: true });

    // Even if an attacker casts or sends a client-side bypass parameter:
    const untrustedClientInput: Record<string, unknown> = {
      allowedPorts: [80, 443],
      allowLoopbackForTesting: true,
      bypassSSRF: true,
    };

    const res = await validatePublicUrl("http://127.0.0.1/api/fixtures", untrustedClientInput);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("PRIVATE_NETWORK");
    }
  });

  it("strictly blocks loopback in production builds even if PROOF_UI_ENABLE_TEST_FIXTURES is set", async () => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true });
    process.env.PROOF_UI_ENABLE_TEST_FIXTURES = "true";

    expect(isServerTestFixtureAllowed()).toBe(false);

    const res = await validatePublicUrl("http://localhost/api/fixtures");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("PRIVATE_NETWORK");
    }
  });

  it("allows loopback strictly when PROOF_UI_ENABLE_TEST_FIXTURES is true and not in production", async () => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "test", configurable: true });
    process.env.PROOF_UI_ENABLE_TEST_FIXTURES = "true";

    expect(isServerTestFixtureAllowed()).toBe(true);

    const res = await validatePublicUrl("http://localhost:3000/api/fixtures/landing-page");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.resolvedAddresses).toContain("127.0.0.1");
    }
  });
});
