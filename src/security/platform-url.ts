import type { Platform } from "../platform";

const PLATFORM_BASE_HOSTS: Record<Platform, readonly string[]> = {
  facebook: ["facebook.com"],
  tiktok: ["tiktok.com"],
  shopee: ["shopee.vn"],
};

function isSameOrSubdomain(hostname: string, baseHost: string): boolean {
  return hostname === baseHost || hostname.endsWith(`.${baseHost}`);
}

export function isAllowedPlatformUrl(input: string, platform: Platform): boolean {
  try {
    const url = new URL(input.trim());

    if (url.protocol !== "https:") {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    return PLATFORM_BASE_HOSTS[platform].some((baseHost) => isSameOrSubdomain(hostname, baseHost));
  } catch {
    return false;
  }
}

export function parsePlatformUrl(input: string, platform: Platform): URL {
  const trimmed = input.trim();

  if (!isAllowedPlatformUrl(trimmed, platform)) {
    throw new Error(`URL is not allowed for ${platform}`);
  }

  return new URL(trimmed);
}
