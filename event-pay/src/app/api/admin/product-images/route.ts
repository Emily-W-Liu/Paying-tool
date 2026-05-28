import { NextResponse } from "next/server";
import { adminAuthError, isAdminAuthenticated } from "@/lib/admin-auth";
import { readProducts, writeProducts } from "@/lib/store";
import { saveProductImage } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return adminAuthError();
    }

    const formData = await request.formData();
    const productId = String(formData.get("productId") ?? "").trim();
    const image = formData.get("image");

    if (!productId || !(image instanceof File)) {
      return NextResponse.json({ message: "缺少商品或图片" }, { status: 400 });
    }

    if (image.type && !image.type.startsWith("image/")) {
      return NextResponse.json({ message: "请上传图片文件" }, { status: 400 });
    }

    const upload = await saveProductImage({
      bytes: Buffer.from(await image.arrayBuffer()),
      fileName: image.name,
      mimeType: image.type || "image/png",
      productId,
      requestUrl: request.url,
    });

    const products = await readProducts();
    const nextProducts = products.map((product) =>
      product.id === productId
        ? {
            ...product,
            imageUrl: upload.publicUrl,
          }
        : product,
    );

    const persisted = nextProducts.some((product) => product.id === productId);

    if (persisted) {
      await writeProducts(nextProducts);
    }

    return NextResponse.json({ imageUrl: upload.publicUrl, persisted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片上传失败";
    return NextResponse.json({ message }, { status: 500 });
  }
}
