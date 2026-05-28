"use client";

export const maxClientUploadBytes = 1.5 * 1024 * 1024;

export function formatFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function loadImageFromUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片读取失败，请换一张图片重试"));
    image.src = url;
  });
}

async function renderCompressedImage(
  file: File,
  maxDimension: number,
  quality: number,
) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageFromUrl(objectUrl);
    const scale = Math.min(
      1,
      maxDimension / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const width = Math.max(Math.round(image.naturalWidth * scale), 1);
    const height = Math.max(Math.round(image.naturalHeight * scale), 1);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("图片压缩失败，请换一张图片重试");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );

    if (!blob) {
      throw new Error("图片压缩失败，请换一张图片重试");
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "upload-image";

    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function prepareImageUpload(
  file: File,
  options: {
    label?: string;
    maxBytes?: number;
  } = {},
) {
  const maxBytes = options.maxBytes ?? maxClientUploadBytes;
  const label = options.label ?? "图片";

  if (!file.type.startsWith("image/")) {
    throw new Error(`请上传${label}文件`);
  }

  const candidates = [
    [1600, 0.78],
    [1400, 0.7],
    [1200, 0.62],
    [900, 0.56],
    [720, 0.5],
  ] as const;

  if (file.size <= maxBytes && file.type === "image/jpeg") {
    return file;
  }

  let smallest: File | null = null;
  for (const [maxDimension, quality] of candidates) {
    const compressed = await renderCompressedImage(file, maxDimension, quality);
    if (!smallest || compressed.size < smallest.size) {
      smallest = compressed;
    }
    if (compressed.size <= maxBytes) {
      return compressed;
    }
  }

  if (smallest && smallest.size <= maxBytes) {
    return smallest;
  }

  throw new Error(
    `${label}太大，压缩后仍超过 ${formatFileSize(maxBytes)}，请换一张更小的图片`,
  );
}
