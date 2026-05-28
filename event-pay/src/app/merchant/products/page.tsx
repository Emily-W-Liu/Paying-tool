"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatFileSize,
  maxClientUploadBytes,
  prepareImageUpload,
} from "@/lib/client-image";
import type { DemoOrder, Product } from "@/lib/order-types";

const defaultAccent = "bg-[#f66f4d]";

type ProductImageUploadResponse = {
  imageUrl?: string;
  persisted?: boolean;
  message?: string;
};

async function readUploadResponse(response: Response) {
  const text = await response.text();

  try {
    return (text ? JSON.parse(text) : {}) as ProductImageUploadResponse;
  } catch {
    if (text.startsWith("Request En")) {
      return {
        message: `图片太大，服务器拒绝接收。请压缩到 ${formatFileSize(
          maxClientUploadBytes,
        )} 以内再上传。`,
      };
    }

    return {
      message: text || "图片上传失败",
    };
  }
}

function emptyProduct(): Product {
  return {
    id: `product-${Date.now()}`,
    name: "新商品",
    description: "",
    price: 0,
    stock: 0,
    stockLocations: {},
    accent: defaultAccent,
    imageUrl: "",
    isActive: true,
  };
}

export default function ProductsAdminPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingImages, setUploadingImages] = useState<Record<string, boolean>>({});
  const [previewImageUrls, setPreviewImageUrls] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const previewObjectUrlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const sessionResponse = await fetch("/api/admin/session");
      const sessionData = (await sessionResponse.json()) as {
        authenticated: boolean;
      };

      if (!sessionData.authenticated) {
        router.replace("/merchant/login?next=/merchant/products");
        return;
      }

      const [productsResponse, ordersResponse] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/orders"),
      ]);
      const productsData = (await productsResponse.json()) as { products: Product[] };
      const ordersData = (await ordersResponse.json()) as { orders: DemoOrder[] };
      setProducts(productsData.products);
      setOrders(ordersData.orders ?? []);
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

  const orderedProductIds = useMemo(
    () => new Set(orders.flatMap((o) => o.items.map((i) => i.id))),
    [orders],
  );

  function validateProducts(list: Product[]): string | null {
    for (const product of list) {
      if (!product.name.trim()) return "商品名不能为空";
      if (product.price < 0) return "价格不能为负数";
      for (const [loc, stock] of Object.entries(product.stockLocations)) {
        if (!loc.trim()) return `「${product.name}」有地区名为空，请填写后再保存`;
        if (stock < 0) return `「${product.name}」库存不能为负数`;
      }
    }
    return null;
  }

  function updateProduct(productId: string, patch: Partial<Product>) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId ? { ...product, ...patch } : product,
      ),
    );
  }

  function addProductLocation(productId: string) {
    setProducts((current) =>
      current.map((product) => {
        if (product.id !== productId) return product;
        const count = Object.keys(product.stockLocations).length;
        const newName = `地区${count + 1}`;
        return { ...product, stockLocations: { ...product.stockLocations, [newName]: 0 } };
      }),
    );
  }

  function removeProductLocation(productId: string, location: string) {
    setProducts((current) =>
      current.map((product) => {
        if (product.id !== productId) return product;
        const stockLocations = { ...product.stockLocations };
        delete stockLocations[location];
        return { ...product, stockLocations };
      }),
    );
  }

  function renameProductLocation(productId: string, oldName: string, newName: string) {
    setProducts((current) =>
      current.map((product) => {
        if (product.id !== productId) return product;
        const entries = Object.entries(product.stockLocations).map(([k, v]) =>
          k === oldName ? [newName, v] : [k, v],
        );
        return { ...product, stockLocations: Object.fromEntries(entries) };
      }),
    );
  }

  function updateLocationStock(productId: string, location: string, stock: number) {
    setProducts((current) =>
      current.map((product) => {
        if (product.id !== productId) return product;
        return {
          ...product,
          stockLocations: { ...product.stockLocations, [location]: Math.max(0, stock) },
        };
      }),
    );
  }

  async function saveProducts() {
    const validationError = validateProducts(products);
    if (validationError) {
      setMessage(validationError);
      setMessageType("error");
      return;
    }

    setIsSaving(true);
    setMessage("");

    // Keep stock field in sync with sum of location stocks
    const productsToSave = products.map((product) => {
      const locationEntries = Object.values(product.stockLocations);
      return locationEntries.length > 0
        ? { ...product, stock: locationEntries.reduce((sum, s) => sum + s, 0) }
        : product;
    });

    const response = await fetch("/api/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products: productsToSave }),
    });
    const data = (await response.json()) as {
      products?: Product[];
      message?: string;
    };

    if (response.ok && data.products) {
      setProducts(data.products);
      setMessage("商品配置已保存");
      setMessageType("success");
    } else {
      setMessage(data.message ?? "保存失败");
      setMessageType("error");
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
    setMessage(file.size > maxClientUploadBytes ? "图片较大，正在压缩..." : "商品图片处理中...");

    try {
      const uploadFile = await prepareImageUpload(file, { label: "图片" });
      const formData = new FormData();
      formData.append("productId", productId);
      formData.append("image", uploadFile);
      setMessage(
        uploadFile.size < file.size
          ? `图片已压缩到 ${formatFileSize(uploadFile.size)}，正在上传...`
          : "商品图片上传中...",
      );

      const response = await fetch("/api/admin/product-images", {
        method: "POST",
        body: formData,
      });
      const data = await readUploadResponse(response);

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
    router.replace("/merchant/login");
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
              href="/merchant"
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
          <div className="grid gap-3 border-b border-[#ede8df] p-4 md:grid-cols-[140px_1fr_100px_1fr_120px]">
            <span className="text-sm font-semibold text-[#6b6257]">图片</span>
            <span className="text-sm font-semibold text-[#6b6257]">商品</span>
            <span className="text-sm font-semibold text-[#6b6257]">价格</span>
            <span className="text-sm font-semibold text-[#6b6257]">地区库存</span>
            <span className="text-sm font-semibold text-[#6b6257]">状态</span>
          </div>

          <div className="divide-y divide-[#ede8df]">
            {products.map((product) => (
              <article
                className="grid gap-3 p-4 md:grid-cols-[140px_1fr_100px_1fr_120px]"
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

                <div className="space-y-1.5">
                  {Object.entries(product.stockLocations).map(([loc, stock]) => (
                    <div className="flex items-center gap-1.5" key={loc}>
                      <input
                        className="h-8 min-w-0 flex-1 rounded border border-[#d8d2c7] px-2 text-xs outline-none focus:border-[#202124]"
                        onBlur={(event) => {
                          const newName = event.target.value.trim();
                          if (newName && newName !== loc) {
                            renameProductLocation(product.id, loc, newName);
                          }
                        }}
                        defaultValue={loc}
                        placeholder="地区名"
                      />
                      <input
                        className="h-8 w-14 rounded border border-[#d8d2c7] px-2 text-xs outline-none focus:border-[#202124]"
                        min="0"
                        onChange={(event) =>
                          updateLocationStock(product.id, loc, Number(event.target.value))
                        }
                        type="number"
                        value={stock}
                      />
                      <button
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[#d5d0c6] text-sm text-[#b3261e]"
                        onClick={() => removeProductLocation(product.id, loc)}
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    className="h-8 w-full rounded border border-dashed border-[#b8b2a7] text-xs text-[#6b6257] hover:border-[#202124] hover:text-[#202124]"
                    onClick={() => addProductLocation(product.id)}
                    type="button"
                  >
                    + 添加地区
                  </button>
                </div>

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

                  {pendingDeleteId === product.id ? (
                    <div className="rounded-md border border-[#fde7e9] bg-[#fff5f5] p-2 text-xs">
                      {orderedProductIds.has(product.id) ? (
                        <>
                          <p className="mb-2 font-medium text-[#b3261e]">此商品已有订单，不建议删除</p>
                          <div className="flex gap-1.5">
                            <button
                              className="flex-1 rounded bg-[#202124] px-2 py-1.5 text-xs font-semibold text-white"
                              onClick={() => {
                                updateProduct(product.id, { isActive: false });
                                setPendingDeleteId(null);
                                setMessage("已改为下架");
                                setMessageType("success");
                              }}
                              type="button"
                            >
                              改为下架
                            </button>
                            <button
                              className="flex-1 rounded border border-[#d5d0c6] px-2 py-1.5 text-xs font-semibold text-[#b3261e]"
                              onClick={() => {
                                setProducts((current) => current.filter((item) => item.id !== product.id));
                                setPendingDeleteId(null);
                              }}
                              type="button"
                            >
                              强制删除
                            </button>
                          </div>
                          <button
                            className="mt-1.5 w-full text-center text-xs text-[#6b6257]"
                            onClick={() => setPendingDeleteId(null)}
                            type="button"
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="mb-2 font-medium text-[#b3261e]">确认删除「{product.name}」？</p>
                          <div className="flex gap-1.5">
                            <button
                              className="flex-1 rounded bg-[#b3261e] px-2 py-1.5 text-xs font-semibold text-white"
                              onClick={() => {
                                setProducts((current) => current.filter((item) => item.id !== product.id));
                                setPendingDeleteId(null);
                              }}
                              type="button"
                            >
                              确认删除
                            </button>
                            <button
                              className="flex-1 rounded border border-[#d5d0c6] px-2 py-1.5 text-xs font-semibold"
                              onClick={() => setPendingDeleteId(null)}
                              type="button"
                            >
                              取消
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <button
                      className="h-10 w-full rounded-md border border-[#d5d0c6] text-sm font-semibold text-[#b3261e]"
                      onClick={() => setPendingDeleteId(product.id)}
                      type="button"
                    >
                      删除
                    </button>
                  )}
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
              <span
                className={`text-sm font-medium ${
                  messageType === "error" ? "text-[#b3261e]" : "text-[#116329]"
                }`}
              >
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
