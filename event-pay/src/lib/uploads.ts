import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSupabaseConfig } from "./supabase";

function getFileExtension(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  return extension && extension.length <= 8 ? extension : ".png";
}

export async function savePaymentScreenshot(options: {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
  orderId: string;
  requestUrl: string;
}) {
  const extension = getFileExtension(options.fileName);
  const objectName = `${options.orderId}-${crypto.randomUUID()}${extension}`;
  const config = getSupabaseConfig();

  if (config) {
    const objectPath = `payments/${objectName}`;
    const response = await fetch(
      `${config.url}/storage/v1/object/${config.bucket}/${objectPath}`,
      {
        method: "POST",
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          "Content-Type": options.mimeType || "image/png",
          "x-upsert": "false",
        },
        body: new Uint8Array(options.bytes),
      },
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Supabase Storage upload failed: ${response.status}`);
    }

    return {
      fileName: objectName,
      publicUrl: `${config.url}/storage/v1/object/public/${config.bucket}/${objectPath}`,
      storage: "supabase" as const,
    };
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, objectName);
  await writeFile(filePath, options.bytes);

  const url = new URL(options.requestUrl);
  const publicBaseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? `${url.protocol}//${url.host}`;

  return {
    fileName: objectName,
    publicUrl: `${publicBaseUrl}/uploads/${objectName}`,
    storage: "local" as const,
  };
}
