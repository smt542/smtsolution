export const MAX_ATTACHMENT_FILES = 10;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const IMAGE_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const DOCUMENT_ATTACHMENT_MIME_TYPES = ["application/pdf"] as const;
export const IMAGE_ATTACHMENT_ACCEPT = IMAGE_ATTACHMENT_MIME_TYPES.join(",");

export type AttachmentFileType = "any" | "image" | "document";

const imageMimeTypes = new Set<string>(IMAGE_ATTACHMENT_MIME_TYPES);
const documentMimeTypes = new Set<string>(DOCUMENT_ATTACHMENT_MIME_TYPES);

export function isImageMimeType(mimeType: string | null | undefined): boolean {
  return Boolean(mimeType && imageMimeTypes.has(mimeType.toLowerCase()));
}

export function imageMimeTypeFromFileName(fileName: string): string | null {
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return null;
}

export function validateAttachmentFile(
  file: File,
  fileType: AttachmentFileType = "any",
): string | null {
  const isImage = isImageMimeType(file.type);
  const isDocument = documentMimeTypes.has(file.type.toLowerCase());
  const acceptsType = fileType === "image"
    ? isImage
    : fileType === "document"
      ? isDocument
      : isImage || isDocument;

  if (!acceptsType) {
    return fileType === "image"
      ? "JPG, PNG, WEBP 이미지만 첨부할 수 있습니다."
      : fileType === "document"
        ? "PDF 문서만 첨부할 수 있습니다."
        : "JPG, PNG, WEBP 이미지 또는 PDF 문서만 첨부할 수 있습니다.";
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return "첨부 파일은 한 개당 10MB 이하여야 합니다.";
  }
  return null;
}

export interface FileSelectionResult {
  accepted: File[];
  errors: string[];
}

export function selectImageFiles(
  currentFiles: readonly File[],
  selectedFiles: readonly File[],
  max = MAX_ATTACHMENT_FILES,
  accept = IMAGE_ATTACHMENT_ACCEPT,
): FileSelectionResult {
  const errors: string[] = [];
  const acceptedMimeTypes = new Set(
    accept.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean),
  );
  const validFiles = selectedFiles.filter((file) => {
    const policyError = validateAttachmentFile(file, "image");
    const acceptError = !acceptedMimeTypes.has(file.type.toLowerCase())
      && !acceptedMimeTypes.has("image/*")
        ? "이 화면에서 허용하지 않는 이미지 형식입니다."
        : null;
    const error = policyError ?? acceptError;
    if (error) errors.push(`${file.name}: ${error}`);
    return !error;
  });
  const availableSlots = Math.max(0, max - currentFiles.length);
  const accepted = validFiles.slice(0, availableSlots);

  if (validFiles.length > availableSlots) {
    errors.push(`이미지는 최대 ${max}장까지 첨부할 수 있습니다.`);
  }

  return { accepted, errors: [...new Set(errors)] };
}

function normalizeStorageSegment(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\\/\u0000-\u001f\u007f]+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  return normalized || fallback;
}

export function normalizeAttachmentFileName(fileName: string): string {
  const leafName = fileName.split(/[\\/]/).at(-1) ?? "file";
  const extensionIndex = leafName.lastIndexOf(".");
  const rawBase = extensionIndex > 0 ? leafName.slice(0, extensionIndex) : leafName;
  const rawExtension = extensionIndex > 0 ? leafName.slice(extensionIndex + 1) : "";
  const base = normalizeStorageSegment(rawBase, "file");
  const extension = normalizeStorageSegment(rawExtension.toLowerCase(), "");
  return extension ? `${base}.${extension}` : base;
}

export function buildAttachmentStoragePath(params: {
  orgId: number;
  entityType: string;
  entityId: number;
  fileName: string;
  uniqueId?: string;
}): string {
  const entityType = normalizeStorageSegment(params.entityType, "attachment");
  const uniqueId = normalizeStorageSegment(
    params.uniqueId ?? crypto.randomUUID(),
    "file",
  );
  return `${params.orgId}/${entityType}/${params.entityId}/${uniqueId}-${normalizeAttachmentFileName(params.fileName)}`;
}
