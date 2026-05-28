"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CartItem, Product } from "@/lib/order-types";

export default function Home() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedLocation, setSelectedLocation] = useState("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const productsResponse = await fetch("/api/products?view=public", {
          cache: "no-store",
        });
        const productsData = (await productsResponse.json()) as {
          products: Product[];
        };
        setProducts(productsResponse.ok ? productsData.products : []);
      } finally {
        setIsLoadingProducts(false);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const locations = useMemo(() => {
    const locSet = new Set<string>();
    for (const product of products) {
      for (const loc of Object.keys(product.stockLocations)) {
        locSet.add(loc);
      }
    }
    return Array.from(locSet);
  }, [products]);

  // Auto-select the first location when products load
  useEffect(() => {
    if (locations.length > 0 && (!selectedLocation || !locations.includes(selectedLocation))) {
      setSelectedLocation(locations[0]);
    }
  }, [locations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset quantities that exceed the new location's stock when switching locations
  useEffect(() => {
    if (!selectedLocation) return;
    setQuantities((current) => {
      const next = { ...current };
      for (const product of products) {
        const locStock = product.stockLocations[selectedLocation] ?? 0;
        if ((next[product.id] ?? 0) > locStock) {
          next[product.id] = locStock;
        }
      }
      return next;
    });
  }, [selectedLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  function getProductStock(product: Product): number {
    if (Object.keys(product.stockLocations).length > 0) {
      return product.stockLocations[selectedLocation] ?? 0;
    }
    return product.stock;
  }

  const cart = useMemo<CartItem[]>(() => {
    return products
      .map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: quantities[product.id] ?? 0,
      }))
      .filter((item) => item.quantity > 0);
  }, [products, quantities]);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  function updateQuantity(productId: string, next: number) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const maxStock = getProductStock(product);
    setQuantities((current) => ({
      ...current,
      [productId]: Math.max(0, Math.min(next, maxStock)),
    }));
  }

  function continueToSubmit() {
    if (!cart.length) return;
    window.localStorage.setItem("event-pay-cart", JSON.stringify(cart));
    window.localStorage.setItem("event-pay-location", selectedLocation);
    router.push("/submit");
  }

  const needsLocation = locations.length > 0;
  const canSubmit = cart.length > 0 && (!needsLocation || Boolean(selectedLocation));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col bg-[#f7f5ef]">
      <section className="px-5 pb-4 pt-6">
        <div>
          <p className="text-sm font-medium text-[#7b341e]">扫码下单</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#202124]">
            周末活动商店
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#5f6368]">
            选择需要的内容和数量，提交后上传付款截图，商家确认后订单会更新为已支付。
          </p>
        </div>
      </section>

      {needsLocation && (
        <section className="px-5 pb-4">
          <p className="mb-2 text-sm font-medium text-[#202124]">选择地区</p>
          <div className="flex flex-wrap gap-2">
            {locations.map((loc) => (
              <button
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  selectedLocation === loc
                    ? "bg-[#202124] text-white"
                    : "border border-[#d8d2c7] bg-white text-[#6b6257]"
                }`}
                key={loc}
                onClick={() => setSelectedLocation(loc)}
                type="button"
              >
                {loc}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="flex-1 space-y-3 px-4 pb-32">
        {isLoadingProducts ? (
          <p className="rounded-lg border border-[#e1ddd4] bg-white p-4 text-sm text-[#6b6257]">
            正在加载商品...
          </p>
        ) : products.length ? (
          products.map((product) => {
            const quantity = quantities[product.id] ?? 0;
            const remaining = getProductStock(product);
            const soldOut = remaining === 0;
            const hasLocations = Object.keys(product.stockLocations).length > 0;

            return (
              <article
                className="grid grid-cols-[72px_1fr] gap-4 rounded-lg border border-[#e1ddd4] bg-white p-4 shadow-sm"
                key={product.id}
              >
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={product.name}
                    className="aspect-square w-full rounded-md border border-[#ede8df] object-cover"
                    src={product.imageUrl}
                  />
                ) : (
                  <div
                    className={`flex aspect-square items-end rounded-md ${product.accent} p-2 text-xs font-semibold text-white`}
                  >
                    ¥{product.price}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-[#202124]">
                        {product.name}
                      </h2>
                      <p className="mt-1 text-sm leading-5 text-[#6b6257]">
                        {product.description}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-[#202124]">
                      ¥{product.price}
                    </p>
                  </div>

                  {hasLocations && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(product.stockLocations).map(([loc, locStock]) => (
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            loc === selectedLocation
                              ? "bg-[#f0ece4] font-medium text-[#202124]"
                              : "text-[#9e9890]"
                          }`}
                          key={loc}
                        >
                          {loc}: {locStock > 0 ? `剩余 ${locStock}` : "已售完"}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    <span
                      className={`text-sm ${
                        soldOut ? "text-[#b3261e]" : "text-[#5f6368]"
                      }`}
                    >
                      {hasLocations
                        ? selectedLocation
                          ? soldOut
                            ? `${selectedLocation} 已售完`
                            : `${selectedLocation} 剩余 ${remaining}`
                          : "请先选择地区"
                        : soldOut
                          ? "库存 0"
                          : `剩余 ${remaining}`}
                    </span>
                    <div className="grid grid-cols-[36px_44px_36px] items-center rounded-md border border-[#d8d2c7]">
                      <button
                        aria-label={`减少 ${product.name}`}
                        className="h-9 text-lg disabled:text-[#b8b2a7]"
                        disabled={quantity === 0}
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        type="button"
                      >
                        -
                      </button>
                      <span className="text-center text-sm font-semibold">
                        {quantity}
                      </span>
                      <button
                        aria-label={`增加 ${product.name}`}
                        className="h-9 text-lg disabled:text-[#b8b2a7]"
                        disabled={soldOut || quantity >= remaining || (needsLocation && !selectedLocation)}
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        type="button"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-lg border border-[#e1ddd4] bg-white p-4 text-sm text-[#6b6257]">
            暂无上架商品，请稍后再试。
          </p>
        )}
      </section>

      <footer className="fixed inset-x-0 bottom-0 border-t border-[#ddd7cc] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#6b6257]">
              已选 {totalQuantity} 件{selectedLocation ? ` · ${selectedLocation}` : ""}
            </p>
            <p className="text-2xl font-semibold text-[#202124]">¥{total}</p>
          </div>
          <button
            className="h-12 rounded-md bg-[#202124] px-6 text-sm font-semibold text-white disabled:bg-[#b8b2a7]"
            disabled={!canSubmit}
            onClick={continueToSubmit}
            type="button"
          >
            提交订单
          </button>
        </div>
      </footer>
    </main>
  );
}
