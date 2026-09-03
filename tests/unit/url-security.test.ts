import { describe, it, expect } from "vitest";
import {
  validatePublicUrl,
  parseAndNormalizeIPv4,
  isPrivateIPv4,
  isPrivateIPv6,
  isForbiddenHostname,
} from "../../src/lib/import/url-security";

describe("URL Security & SSRF Defense Module", () => {
  describe("parseAndNormalizeIPv4", () => {
    it("parses standard dotted decimal IPv4", () => {
      expect(parseAndNormalizeIPv4("192.168.1.1")).toBe("192.168.1.1");
      expect(parseAndNormalizeIPv4("8.8.8.8")).toBe("8.8.8.8");
    });

    it("parses decimal representation of IP", () => {
      // 2130706433 = 127.0.0.1
      expect(parseAndNormalizeIPv4("2130706433")).toBe("127.0.0.1");
    });

    it("parses hex representation of IP", () => {
      // 0x7f000001 = 127.0.0.1
      expect(parseAndNormalizeIPv4("0x7f000001")).toBe("127.0.0.1");
    });

    it("parses octal and mixed notation", () => {
      expect(parseAndNormalizeIPv4("0177.0.0.1")).toBe("127.0.0.1");
    });

    it("returns null for non-IPv4 strings", () => {
      expect(parseAndNormalizeIPv4("example.com")).toBeNull();
      expect(parseAndNormalizeIPv4("not-an-ip")).toBeNull();
    });
  });

  describe("isPrivateOrReservedIP", () => {
    it("identifies private IPv4 ranges (RFC1918)", () => {
      expect(isPrivateIPv4("10.0.0.1")).toBe(true);
      expect(isPrivateIPv4("10.254.254.254")).toBe(true);
      expect(isPrivateIPv4("172.16.0.1")).toBe(true);
      expect(isPrivateIPv4("172.31.255.255")).toBe(true);
      expect(isPrivateIPv4("192.168.0.1")).toBe(true);
      expect(isPrivateIPv4("192.168.254.254")).toBe(true);
    });

    it("identifies loopback and link-local IPv4", () => {
      expect(isPrivateIPv4("127.0.0.1")).toBe(true);
      expect(isPrivateIPv4("127.100.50.1")).toBe(true);
      expect(isPrivateIPv4("169.254.169.254")).toBe(true); // Cloud metadata
      expect(isPrivateIPv4("169.254.1.1")).toBe(true);
    });

    it("identifies carrier-grade NAT & broadcast", () => {
      expect(isPrivateIPv4("100.64.0.1")).toBe(true);
      expect(isPrivateIPv4("0.0.0.0")).toBe(true);
      expect(isPrivateIPv4("255.255.255.255")).toBe(true);
    });

    it("allows public IPv4 addresses", () => {
      expect(isPrivateIPv4("93.184.216.34")).toBe(false); // example.com
      expect(isPrivateIPv4("8.8.8.8")).toBe(false);
      expect(isPrivateIPv4("1.1.1.1")).toBe(false);
    });

    it("identifies private and loopback IPv6 addresses", () => {
      expect(isPrivateIPv6("::1")).toBe(true);
      expect(isPrivateIPv6("::")).toBe(true);
      expect(isPrivateIPv6("fe80::1")).toBe(true); // link-local
      expect(isPrivateIPv6("fc00::1")).toBe(true); // unique-local
      expect(isPrivateIPv6("fd12:3456:789a::1")).toBe(true);
      expect(isPrivateIPv6("::ffff:127.0.0.1")).toBe(true); // IPv4-mapped
      expect(isPrivateIPv6("::ffff:192.168.1.1")).toBe(true);
    });
  });

  describe("isForbiddenHostname", () => {
    it("flags local, internal, and cloud metadata hostnames", () => {
      expect(isForbiddenHostname("localhost")).toBe(true);
      expect(isForbiddenHostname("sub.localhost")).toBe(true);
      expect(isForbiddenHostname("service.internal")).toBe(true);
      expect(isForbiddenHostname("printer.local")).toBe(true);
      expect(isForbiddenHostname("metadata.google.internal")).toBe(true);
      expect(isForbiddenHostname("169.254.169.254")).toBe(true);
      expect(isForbiddenHostname("example.com")).toBe(false);
    });
  });

  describe("validatePublicUrl", () => {
    it("accepts valid public HTTPS URL", async () => {
      const res = await validatePublicUrl("https://example.com");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.normalizedUrl).toBe("https://example.com/");
        expect(res.resolvedAddresses.length).toBeGreaterThan(0);
      }
    });

    it("rejects non-HTTP protocols", async () => {
      const protocols = [
        "file:///etc/passwd",
        "data:text/html,<script>alert(1)</script>",
        "blob:https://example.com/uuid",
        "javascript:alert(1)",
        "ftp://example.com/file",
        "ws://example.com/socket",
        "chrome://settings",
      ];

      for (const url of protocols) {
        const res = await validatePublicUrl(url);
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.code).toBe("UNSUPPORTED_PROTOCOL");
        }
      }
    });

    it("rejects credentials embedded in URL", async () => {
      const res = await validatePublicUrl("https://admin:secret@example.com/dash");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("CREDENTIALS_NOT_ALLOWED");
      }
    });

    it("rejects disallowed ports", async () => {
      const res = await validatePublicUrl("https://example.com:8443/test");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("DISALLOWED_PORT");
      }
    });

    it("rejects localhost and loopbacks", async () => {
      const res1 = await validatePublicUrl("http://localhost/");
      expect(res1.ok).toBe(false);
      if (!res1.ok) expect(res1.code).toBe("PRIVATE_NETWORK");

      const res2 = await validatePublicUrl("http://127.0.0.1/");
      expect(res2.ok).toBe(false);
      if (!res2.ok) expect(res2.code).toBe("PRIVATE_NETWORK");
    });

    it("rejects alternate decimal/hex loopback IPs", async () => {
      // 2130706433 = 127.0.0.1
      const res = await validatePublicUrl("http://2130706433/");
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe("PRIVATE_NETWORK");

      // 0x7f000001 = 127.0.0.1
      const resHex = await validatePublicUrl("http://0x7f000001/");
      expect(resHex.ok).toBe(false);
      if (!resHex.ok) expect(resHex.code).toBe("PRIVATE_NETWORK");
    });

    it("rejects cloud metadata IP address", async () => {
      const res = await validatePublicUrl("http://169.254.169.254/latest/meta-data/");
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe("PRIVATE_NETWORK");
    });

    it("rejects private RFC1918 IPv4 destinations", async () => {
      const res1 = await validatePublicUrl("http://192.168.1.1/router");
      expect(res1.ok).toBe(false);
      if (!res1.ok) expect(res1.code).toBe("PRIVATE_NETWORK");

      const res2 = await validatePublicUrl("http://10.0.0.5/");
      expect(res2.ok).toBe(false);
      if (!res2.ok) expect(res2.code).toBe("PRIVATE_NETWORK");
    });

    it("handles DNS failures gracefully with DNS_FAILURE error", async () => {
      const res = await validatePublicUrl("https://this-domain-definitely-does-not-exist-987654321.com");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("DNS_FAILURE");
        expect(res.message).toContain("Unable to resolve host");
      }
    });

    it("allows loopback when server test fixture config is enabled", async () => {
      process.env.PROOF_UI_ENABLE_TEST_FIXTURES = "true";
      const res = await validatePublicUrl("http://localhost/test");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.resolvedAddresses).toContain("127.0.0.1");
      }
      delete process.env.PROOF_UI_ENABLE_TEST_FIXTURES;
    });
  });
});
