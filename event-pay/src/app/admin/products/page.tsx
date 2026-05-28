"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/order-types";

const defaultAccent = "bg-[#f66f4d]";

function emptyProduct(): Product {
  return {
    id: `product-${Date.now()}`,
    name: "新商品",
    description: "",
    price: 0,
    stock: 0,
    accent: defaultAccent,
    imageUrl: "",
    isActive: true,
  };
}

export default function ProductsAdminPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingImages, setUploadingImages] = useState<Record<string, boolean>>({});
  const [previewImageUrls, setPreviewImageUrls] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const previewObjectUrlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const sessionResponse = await fetch("/api/admin/session");
      const sessionData = (await sessionResponse.json()) as {
        authenticated: boolean;
      };

      if (!sessionData.authenticated) {
        router.replace("/admin/login?next=/admin/products");
        return;
      }

      const response = await fetch("/api/products");
      const data = (await response.json()) as { products: Product[] };
      setProducts(data.products);
      setIsLoading(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    const previewObjectUrls = previewObjectUrlsRef.current;

    return () => {
      Object.values(previewObjectUrls).forEach((url) =>
        URL.revokeObjectURL(url),
      );
    };
  }, []);

  function updateProduct(productId: string, patch: Partial<Product>) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId ? { ...product, ...patch } : product,
      ),
    );
  }

  async function saveProducts() {
    setIsSaving(true);
    setMessage("");

    const response = await fetch("/api/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products }),
    });
    const data = (await response.json()) as {
      products?: Product[];
      message?: string;
    };

    if (response.ok && data.products) {
      setProducts(data.products);
      setMessage("商品配置已保存");
    } else {
      setMessage(data.message ?? "保存失败");
    }

    setIsSaving(false);
  }

  async function uploadProductImage(productId: string, file?: File) {
    if (!file) return;

    const previousPreviewUrl = previewObjectUrlsRef.current[productId];
    if (previousPreviewUrl) {
      URL.revokeObjectURL(previousPreviewUrl);
    }
    const nextPreviewUrl = URL.createObjectURL(file);
    previewObjectUrlsRef.current[productId] = nextPreviewUrl;
    setPreviewImageUrls((current) => ({
      ...current,
      [productId]: nextPreviewUrl,
    }));
    setUploadingImages((current) => ({ ...current, [productId]: true }));
    setMessage("商品图片上传中...");

    try {
      const formData = new FormData();
      formData.append("productId", productId);
      formData.append("image", file);

      const response = await fetch("/api/admin/product-images", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        imageUrl?: string;
        persisted?: boolean;
        message?: string;
      };

      if (!response.ok || !data.imageUrl) {
        throw new Error(data.message ?? "图片上传失败");
      }

      updateProduct(productId, { imageUrl: data.imageUrl });
      URL.revokeObjectURL(nextPreviewUrl);
      delete previewObjectUrlsRef.current[productId];
      setPreviewImageUrls((current) => {
        const next = { ...current };
        delete next[productId];
        return next;
      });
      setMessage(data.persisted ? "商品图片已上传并保存" : "商品图片已上传，记得保存配置");
    } catch (error) {
      URL.revokeObjectURL(nextPreviewUrl);
      delete previewObjectUrlsRef.current[productId];
      setPreviewImageUrls((current) => {
        const next = { ...current };
        delete next[productId];
        return next;
      });
      setMessage(error instanceof Error ? error.message : "图片上传失败");
    } finally {
      setUploadingImages((current) => ({ ...current, [productId]: false }));
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f7f5ef] px-4 py-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-[#6b6257]">正在验证后台登录...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#7b341e]">商家后台</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              商品配置
            </h1>
          </div>
          <div className="flex gap-2">
            <Link
              className="rounded-md border border-[#d5d0c6] bg-white px-3 py-2 text-sm font-medium"
              href="/admin"
            >
              返回后台
            </Link>
            <Link
              className="rounded-md border border-[#d5d0c6] bg-white px-3 py-2 text-sm font-medium"
              href="/"
            >
              商品页
            </Link>
            <button
              className="rounded-md border border-[#d5d0c6] bg-white px-3 py-2 text-sm font-medium"
              onClick={logout}
              type="button"
            >
              退出
            </button>
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-lg border border-[#e1ddd4] bg-white">
          <div className="grid gap-3 border-b border-[#ede8df] p-4 md:grid-cols-[140px_1fr_120px_120px_120px]">
            <span className="text-sm font-semibold text-[#6b6257]">图片</span>
            <span className="text-sm font-semibold text-[#6b6257]">商品</span>
            <span className="text-sm font-semibold text-[#6b6257]">价格</span>
            <span className="text-sm font-semibold text-[#6b6257]">库存</span>
            <span className="text-sm font-semibold text-[#6b6257]">状态</span>
          </div>

          <div className="divide-y divide-[#ede8df]">
            {products.map((product) => (
              <article
                className="grid gap-3 p-4 md:grid-cols-[140px_1fr_120px_120px_120px]"
                key={product.id}
              >
                <div className="space-y-2">
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border border-[#d8d2c7] bg-[#f7f5ef]">
                    {previewImageUrls[product.id] || product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={product.name}
                        className="h-full w-full object-cover"
                        src={previewImageUrls[product.id] || product.imageUrl}
                      />
                    ) : (
                      <span className="px-3 text-center text-xs text-[#6b6257]">
                        暂无图片
                      </span>
                    )}
                  </div>
                  <label className="block">
                    <span className="sr-only">上传商品图片</span>
                    <input
                      accept="image/*"
                      className="block w-full text-xs"
                      disabled={uploadingImages[product.id]}
                      onChange={(event) => {
                        uploadProductImage(product.id, event.target.files?.[0]);
                        event.target.value = "";
                      }}
                      type="file"
                    />
                  </label>
                  {product.imageUrl ? (
                    <button
                      className="h-9 w-full rounded-md border border-[#d5d0c6] text-xs font-semibold"
                      onClick={() => updateProduct(product.id, { imageUrl: "" })}
                      type="button"
                    >
                      移除图片
                    </button>
                  ) : null}
                  {uploadingImages[product.id] ? (
                    <p className="text-xs text-[#6b6257]">上传中...</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <input
                    className="h-10 w-full rounded-md border border-[#d8d2c7] px-3 text-sm font-semibold outline-none focus:border-[#202124]"
                    onChange={(event) =>
                      updateProduct(product.id, { name: event.target.value })
                    }
                    value={product.name}
                  />
                  <textarea
                    className="min-h-20 w-full rounded-md border border-[#d8d2c7] p-3 text-sm outline-none focus:border-[#202124]"
                    onChange={(event) =>
                      updateProduct(product.id, {
                        description: event.target.value,
                      })
                    }
                    value={product.description}
                  />
                </div>

                <input
                  className="h-10 rounded-md border border-[#d8d2c7] px-3 text-sm outline-none focus:border-[#202124]"
                  min="0"
                  onChange={(event) =>
                    updateProduct(product.id, {
                      price: Number(event.target.value),
                    })
                  }
                  type="number"
                  value={product.price}
                />

                <input
                  className="h-10 rounded-md border border-[#d8d2c7] px-3 text-sm outline-none focus:border-[#202124]"
                  min="0"
                  onChange={(event) =>
                    updateProduct(product.id, {
                      stock: Number(event.target.value),
                    })
                  }
                  type="number"
                  value={product.stock}
                />

                <div className="space-y-2">
                  <label className="flex h-10 items-center gap-2 rounded-md border border-[#d8d2c7] px-3 text-sm">
                    <input
                      checked={product.isActive}
                      onChange={(event) =>
                        updateProduct(product.id, {
                          isActive: event.target.checked,
                        })
                      }
                      type="checkbox"
                    />
                    上架
                  </label>
                  <button
                    className="h-10 w-full rounded-md border border-[#d5d0c6] text-sm font-semibold text-[#b3261e]"
                    onClick={() =>
                      setProducts((current) =>
                        current.filter((item) => item.id !== product.id),
                      )
                    }
                    type="button"
                  >
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            className="h-11 rounded-md border border-[#d5d0c6] bg-white px-4 text-sm font-semibold"
            onClick={() => setProducts((current) => [...current, emptyProduct()])}
            type="button"
          >
            新增商品
          </button>
          <div className="flex items-center gap-3">
            {message ? (
              <span className="text-sm font-medium text-[#6b6257]">
                {message}
              </span>
            ) : null}
            <button
              className="h-11 rounded-md bg-[#202124] px-5 text-sm font-semibold text-white disabled:bg-[#b8b2a7]"
              disabled={isSaving || Object.values(uploadingImages).some(Boolean)}
              onClick={saveProducts}
              type="button"
            >
              {isSaving ? "保存中" : "保存配置"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
