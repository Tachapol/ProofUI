import dns from "dns/promises";
import net from "net";

export type URLValidationErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "CREDENTIALS_NOT_ALLOWED"
  | "PRIVATE_NETWORK"
  | "DISALLOWED_PORT"
  | "DNS_FAILURE"
  | "REDIRECT_BLOCKED";

export type URLValidationResult =
  | {
      ok: true;
      normalizedUrl: string;
      resolvedAddresses: string[];
    }
  | {
      ok: false;
      code: URLValidationErrorCode;
      message: string;
    };

export interface URLValidationOptions {
  allowedPorts?: number[]; // default: [80, 443]
}

export function isServerTestFixtureAllowed(): boolean {
  // Impossible in production builds
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.PROOF_UI_ENABLE_TEST_FIXTURES === "true";
}

// Convert an IPv4 string or numeric/hex/octal into standard dotted-decimal
export function parseAndNormalizeIPv4(input: string): string | null {
  const trimmed = input.trim();

  // If already standard 4 dotted decimals, parse parts
  const parts = trimmed.split(".");
  if (parts.length === 4) {
    const bytes: number[] = [];
    for (const p of parts) {
      let num: number;
      if (p.startsWith("0x") || p.startsWith("0X")) {
        num = parseInt(p, 16);
      } else if (p.length > 1 && p.startsWith("0")) {
        num = parseInt(p, 8);
      } else {
        num = parseInt(p, 10);
      }
      if (isNaN(num) || num < 0 || num > 255) return null;
      bytes.push(num);
    }
    return bytes.join(".");
  }

  // Single integer or hex/octal number representing a 32-bit IP (e.g. 2130706433 or 0x7f000001)
  if (/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(trimmed)) {
    let intVal: number;
    if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
      intVal = parseInt(trimmed, 16);
    } else if (trimmed.length > 1 && trimmed.startsWith("0")) {
      intVal = parseInt(trimmed, 8);
    } else {
      intVal = parseInt(trimmed, 10);
    }

    if (isNaN(intVal) || intVal < 0 || intVal > 0xffffffff) return null;
    const b1 = (intVal >>> 24) & 0xff;
    const b2 = (intVal >>> 16) & 0xff;
    const b3 = (intVal >>> 8) & 0xff;
    const b4 = intVal & 0xff;
    return `${b1}.${b2}.${b3}.${b4}`;
  }

  return null;
}

// Check if standard IPv4 is private/reserved
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return true;
  const [b1, b2] = parts;

  // 0.0.0.0/8 (Current network)
  if (b1 === 0) return true;

  // 127.0.0.0/8 (Loopback)
  if (b1 === 127) return true;

  // 10.0.0.0/8 (RFC1918 Private)
  if (b1 === 10) return true;

  // 172.16.0.0/12 (RFC1918 Private)
  if (b1 === 172 && b2 >= 16 && b2 <= 31) return true;

  // 192.168.0.0/16 (RFC1918 Private)
  if (b1 === 192 && b2 === 168) return true;

  // 169.254.0.0/16 (Link-Local & Cloud Metadata, e.g. 169.254.169.254)
  if (b1 === 169 && b2 === 254) return true;

  // 100.64.0.0/10 (Carrier-grade NAT)
  if (b1 === 100 && b2 >= 64 && b2 <= 127) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (b1 === 192 && b2 === 0 && parts[2] === 0) return true;

  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET documentation)
  if (b1 === 192 && b2 === 0 && parts[2] === 2) return true;
  if (b1 === 198 && b2 === 51 && parts[2] === 100) return true;
  if (b1 === 203 && b2 === 0 && parts[2] === 113) return true;

  // 224.0.0.0/4 (Multicast)
  if (b1 >= 224 && b1 <= 239) return true;

  // 240.0.0.0/4 (Reserved) & 255.255.255.255 (Broadcast)
  if (b1 >= 240) return true;

  return false;
}

// Check if IPv6 address is private/reserved
export function isPrivateIPv6(ip: string): boolean {
  const norm = ip.toLowerCase();

  // ::1 (Loopback) or :: (Unspecified)
  if (norm === "::1" || norm === "::") return true;

  // IPv4-mapped IPv6 (::ffff:192.168.1.1 or ::ffff:7f00:1)
  if (norm.startsWith("::ffff:") || norm.includes("::ffff:")) {
    const ipv4Candidate = norm.split(":").pop();
    if (ipv4Candidate && net.isIP(ipv4Candidate) === 4) {
      return isPrivateIPv4(ipv4Candidate);
    }
    return true;
  }

  // fc00::/7 (Unique Local Address - RFC4193)
  if (norm.startsWith("fc") || norm.startsWith("fd")) return true;

  // fe80::/10 (Link-Local)
  if (norm.startsWith("fe8") || norm.startsWith("fe9") || norm.startsWith("fea") || norm.startsWith("feb")) {
    return true;
  }

  // ff00::/8 (Multicast)
  if (norm.startsWith("ff")) return true;

  // 2001:db8::/32 (Documentation)
  if (norm.startsWith("2001:db8:") || norm.startsWith("2001:0db8:")) return true;

  return false;
}

// Full IP check covering both IPv4 and IPv6
export function isPrivateOrReservedIP(ip: string): boolean {
  // Check if it's encoded or alternate IPv4 format
  const normalizedIPv4 = parseAndNormalizeIPv4(ip);
  if (normalizedIPv4) {
    return isPrivateIPv4(normalizedIPv4);
  }

  const version = net.isIP(ip);
  if (version === 4) {
    return isPrivateIPv4(ip);
  }
  if (version === 6) {
    return isPrivateIPv6(ip);
  }

  // Unknown or invalid IP is treated as private/blocked by default
  return true;
}

// Check hostname for reserved suffixes and cloud metadata names
export function isForbiddenHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  if (lower === "localhost" || lower.endsWith(".localhost")) return true;
  if (lower.endsWith(".local") || lower.endsWith(".internal")) return true;
  if (lower.endsWith(".lan") || lower.endsWith(".home")) return true;

  // Cloud metadata hosts
  if (lower === "metadata.google.internal" || lower === "instance-data") return true;
  if (lower.includes("169.254.169.254")) return true;

  return false;
}

export async function validatePublicUrl(
  inputUrl: string,
  options: URLValidationOptions = {}
): Promise<URLValidationResult> {
  const allowedPorts = options.allowedPorts ?? [80, 443];

  if (!inputUrl || typeof inputUrl !== "string" || !inputUrl.trim()) {
    return {
      ok: false,
      code: "INVALID_URL",
      message: "Please enter a valid website URL.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(inputUrl.trim());
  } catch {
    return {
      ok: false,
      code: "INVALID_URL",
      message: "Malformed URL format. Ensure it starts with http:// or https://",
    };
  }

  // 1. Protocol Validation
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      code: "UNSUPPORTED_PROTOCOL",
      message: `Protocol "${parsed.protocol}" is not supported. Only http: and https: are allowed.`,
    };
  }

  // 2. Credentials Disallowed
  if (parsed.username || parsed.password) {
    return {
      ok: false,
      code: "CREDENTIALS_NOT_ALLOWED",
      message: "URLs containing embedded usernames or passwords are not permitted.",
    };
  }

  const allowLoopback = isServerTestFixtureAllowed();

  // 3. Port Validation
  const port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === "https:" ? 443 : 80;
  if (!allowLoopback && !allowedPorts.includes(port)) {
    return {
      ok: false,
      code: "DISALLOWED_PORT",
      message: `Port ${port} is not permitted. Only standard web ports (${allowedPorts.join(", ")}) are allowed.`,
    };
  }

  // 4. Hostname Check
  const hostname = parsed.hostname;
  if (!hostname) {
    return {
      ok: false,
      code: "INVALID_URL",
      message: "URL hostname cannot be empty.",
    };
  }

  // Server-side test fixture exemption (strictly when server test environment condition is met)
  if (allowLoopback && (hostname === "localhost" || hostname === "127.0.0.1")) {
    return {
      ok: true,
      normalizedUrl: parsed.toString(),
      resolvedAddresses: ["127.0.0.1"],
    };
  }

  if (isForbiddenHostname(hostname)) {
    return {
      ok: false,
      code: "PRIVATE_NETWORK",
      message: `Access to local or internal network destination "${hostname}" is prohibited.`,
    };
  }

  // 5. Direct IP checks (handles alternate integer, octal, hex formats)
  const normalizedDirectIPv4 = parseAndNormalizeIPv4(hostname);
  if (normalizedDirectIPv4) {
    if (isPrivateIPv4(normalizedDirectIPv4)) {
      return {
        ok: false,
        code: "PRIVATE_NETWORK",
        message: `Destination IP "${hostname}" (${normalizedDirectIPv4}) is in a private or reserved network.`,
      };
    }
    return {
      ok: true,
      normalizedUrl: parsed.toString(),
      resolvedAddresses: [normalizedDirectIPv4],
    };
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIP(hostname)) {
      return {
        ok: false,
        code: "PRIVATE_NETWORK",
        message: `Destination IP "${hostname}" is in a private or reserved network.`,
      };
    }
    return {
      ok: true,
      normalizedUrl: parsed.toString(),
      resolvedAddresses: [hostname],
    };
  }

  // 6. Server-Side DNS Resolution
  let addresses: string[] = [];
  try {
    const lookupResults = await dns.lookup(hostname, { all: true });
    addresses = lookupResults.map((r) => r.address);
  } catch {
    return {
      ok: false,
      code: "DNS_FAILURE",
      message: `Unable to resolve host "${hostname}". Check the domain name or network connection.`,
    };
  }

  if (addresses.length === 0) {
    return {
      ok: false,
      code: "DNS_FAILURE",
      message: `No IP addresses found for host "${hostname}".`,
    };
  }

  // Validate every resolved IP against private and reserved ranges (defends against DNS rebinding)
  for (const addr of addresses) {
    if (isPrivateOrReservedIP(addr)) {
      return {
        ok: false,
        code: "PRIVATE_NETWORK",
        message: `Host "${hostname}" resolves to a private or reserved IP address (${addr}). Request blocked for security.`,
      };
    }
  }

  return {
    ok: true,
    normalizedUrl: parsed.toString(),
    resolvedAddresses: addresses,
  };
}
