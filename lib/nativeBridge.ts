"use client";

export type NativeFilePayload = {
  name: string;
  type: string;
  dataBase64: string;
};

type NativeBridge = {
  pickCameraImages?: () => Promise<NativeFilePayload[]>;
  pickDocumentFiles?: () => Promise<NativeFilePayload[]>;
  shareFile?: (file: NativeFilePayload) => Promise<void>;
  saveFile?: (file: NativeFilePayload) => Promise<void>;
};

declare global {
  interface Window {
    DocuScanNative?: NativeBridge;
  }
}

function bridge(): NativeBridge | null {
  if (typeof window === "undefined") return null;
  return window.DocuScanNative ?? null;
}

export function hasNativeBridge(): boolean {
  return bridge() != null;
}

function base64ToFile(payload: NativeFilePayload): File {
  const binary = atob(payload.dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], payload.name, { type: payload.type || "application/octet-stream" });
}

async function bytesToBase64(bytes: Uint8Array): Promise<string> {
  const blob = new Blob([bytes as BlobPart]);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return dataUrl.split(",", 2)[1] ?? "";
}

export async function pickNativeCameraImages(): Promise<File[] | null> {
  const fn = bridge()?.pickCameraImages;
  if (!fn) return null;
  return (await fn()).map(base64ToFile);
}

export async function pickNativeDocumentFiles(): Promise<File[] | null> {
  const fn = bridge()?.pickDocumentFiles;
  if (!fn) return null;
  return (await fn()).map(base64ToFile);
}

export async function nativeShareFile(
  bytes: Uint8Array,
  fileName: string,
  type = "application/pdf",
): Promise<boolean> {
  const native = bridge();
  const fn = native?.shareFile ?? native?.saveFile;
  if (!fn) return false;
  await fn({ name: fileName, type, dataBase64: await bytesToBase64(bytes) });
  return true;
}
