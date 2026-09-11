export type Platform = "facebook" | "tiktok" | "shopee";

export const PLATFORMS: readonly Platform[] = ["facebook", "tiktok", "shopee"];

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && PLATFORMS.includes(value as Platform);
}
