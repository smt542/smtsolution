import { createClient } from "@/lib/supabase/client";
import { isImageMimeType } from "./policy";

export type AttachmentImagePreset = "original" | "thumbnail" | "preview";

export const IMAGE_TRANSFORM_PRESETS = {
  thumbnail: { width: 320, height: 240, resize: "cover", quality: 60 },
  preview: { width: 1280, height: 1280, resize: "contain", quality: 80 },
} as const;

export const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60;
export const SIGNED_URL_STALE_TIME_MS = 50 * 60 * 1000;
export const SIGNED_URL_GC_TIME_MS = 55 * 60 * 1000;

export const IMAGE_TRANSFORMATIONS_ENABLED =
  process.env.NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORMATIONS_ENABLED === "true";

export function signedUrlOptions(params: {
  preset: AttachmentImagePreset;
  mimeType?: string | null;
  transformationsEnabled?: boolean;
  download?: boolean | string;
}) {
  const {
    preset,
    mimeType,
    transformationsEnabled = IMAGE_TRANSFORMATIONS_ENABLED,
    download,
  } = params;
  const transform = preset !== "original"
    && transformationsEnabled
    && isImageMimeType(mimeType)
      ? IMAGE_TRANSFORM_PRESETS[preset]
      : undefined;

  if (!transform && download === undefined) return undefined;
  return { ...(transform ? { transform } : {}), ...(download !== undefined ? { download } : {}) };
}

export async function createPrivateAssetSignedUrl(params: {
  bucket: string;
  path: string;
  preset?: AttachmentImagePreset;
  mimeType?: string | null;
  expiresInSec?: number;
  transformationsEnabled?: boolean;
  download?: boolean | string;
}): Promise<string> {
  const {
    bucket,
    path,
    preset = "original",
    mimeType,
    expiresInSec = SIGNED_URL_EXPIRES_IN_SECONDS,
    transformationsEnabled,
    download,
  } = params;
  const options = signedUrlOptions({ preset, mimeType, transformationsEnabled, download });
  const storage = createClient().storage.from(bucket);
  const result = options
    ? await storage.createSignedUrl(path, expiresInSec, options)
    : await storage.createSignedUrl(path, expiresInSec);
  if (result.error) throw new Error(result.error.message);
  return result.data.signedUrl;
}
