import { isIP } from "node:net";

export type LinkPreview = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
]);

function isPrivateOrBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(h)) return true;
  if (h.endsWith(".local") || h.endsWith(".internal")) return true;

  if (isIP(h)) {
    if (h === "127.0.0.1" || h === "::1") return true;
    if (h.startsWith("10.") || h.startsWith("192.168.") || h.startsWith("169.254.")) {
      return true;
    }
    if (h.startsWith("172.")) {
      const second = Number.parseInt(h.split(".")[1] ?? "", 10);
      if (second >= 16 && second <= 31) return true;
    }
  }
  return false;
}

export function assertSafeExternalUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http(s) URLs are allowed.");
  }

  if (isPrivateOrBlockedHost(url.hostname)) {
    throw new Error("URL host is not allowed.");
  }

  return url;
}

function readMetaContent(html: string, property: string): string | undefined {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return undefined;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function readTitleTag(html: string): string | undefined {
  const match = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : undefined;
}

function resolveMaybeRelative(base: URL, value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, base).toString();
  } catch {
    return undefined;
  }
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview> {
  const url = assertSafeExternalUrl(rawUrl);

  const res = await fetch(url.toString(), {
    redirect: "follow",
    signal: AbortSignal.timeout(6000),
    headers: {
      "User-Agent": "WandrAI/1.0 (+link-preview)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    return {
      url: url.toString(),
      siteName: url.hostname.replace(/^www\./, ""),
    };
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return {
      url: url.toString(),
      siteName: url.hostname.replace(/^www\./, ""),
    };
  }

  const html = (await res.text()).slice(0, 120_000);

  const title =
    readMetaContent(html, "og:title") ??
    readMetaContent(html, "twitter:title") ??
    readTitleTag(html);
  const description =
    readMetaContent(html, "og:description") ?? readMetaContent(html, "description");
  const image = resolveMaybeRelative(
    url,
    readMetaContent(html, "og:image") ?? readMetaContent(html, "twitter:image"),
  );
  const siteName =
    readMetaContent(html, "og:site_name") ?? url.hostname.replace(/^www\./, "");

  return {
    url: url.toString(),
    title,
    description,
    image,
    siteName,
  };
}
