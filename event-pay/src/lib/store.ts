import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { products as fallbackProducts } from "./catalog";
import type { CartItem, DemoOrder, OrderStatus, Product } from "./order-types";
import { getSupabaseConfig, supabaseJson } from "./supabase";

type ProductRow = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  accent: string;
  image_url?: string | null;
  is_active: boolean;
};

type OrderRow = {
  id: string;
  created_at: string;
  customer_name: string;
  contact: string;
  note: string;
  items: CartItem[];
  total: number;
  screenshot_name: string;
  screenshot_url: string;
  status: OrderStatus;
  feishu_record_id?: string | null;
  feishu_sync_status?: "skipped" | "synced" | "failed" | null;
  feishu_sync_message?: string | null;
};

const dataDir = path.join(process.cwd(), "data");
const productsPath = path.join(dataDir, "products.json");
const ordersPath = path.join(dataDir, "orders.json");

function isSupabaseEnabled() {
  return Boolean(getSupabaseConfig());
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    stock: Number(row.stock),
    accent: row.accent,
    imageUrl: row.image_url ?? "",
    isActive: row.is_active,
  };
}

function toProductRow(product: Product): ProductRow {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    stock: product.stock,
    accent: product.accent,
    image_url: product.imageUrl ?? "",
    is_active: product.isActive,
  };
}

function toOrder(row: OrderRow): DemoOrder {
  return {
    id: row.id,
    createdAt: row.created_at,
    customerName: row.customer_name,
    contact: row.contact,
    note: row.note,
    items: row.items,
    total: Number(row.total),
    screenshotName: row.screenshot_name,
    screenshotUrl: row.screenshot_url,
    status: row.status,
    feishuRecordId: row.feishu_record_id ?? undefined,
    feishuSyncStatus: row.feishu_sync_status ?? undefined,
    feishuSyncMessage: row.feishu_sync_message ?? undefined,
  };
}

function toOrderRow(order: DemoOrder): OrderRow {
  return {
    id: order.id,
    created_at: order.createdAt,
    customer_name: order.customerName,
    contact: order.contact,
    note: order.note,
    items: order.items,
    total: order.total,
    screenshot_name: order.screenshotName,
    screenshot_url: order.screenshotUrl,
    status: order.status,
    feishu_record_id: order.feishuRecordId ?? null,
    feishu_sync_status: order.feishuSyncStatus ?? null,
    feishu_sync_message: order.feishuSyncMessage ?? null,
  };
}

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  await ensureDataDir();
  try {
    const file = await readFile(filePath, "utf8");
    return JSON.parse(file) as T;
  } catch {
    await writeJsonFile(filePath, fallback);
    return fallback;
  }
}

async function writeJsonFile<T>(filePath: string, data: T) {
  await ensureDataDir();
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function readProducts() {
  if (isSupabaseEnabled()) {
    const rows = await supabaseJson<ProductRow[]>(
      "/rest/v1/products?select=*&order=id.asc",
    );

    return rows.map(toProduct);
  }

  return readJsonFile<Product[]>(productsPath, fallbackProducts);
}

export async function writeProducts(products: Product[]) {
  if (isSupabaseEnabled()) {
    const existing = await readProducts();
    const nextIds = new Set(products.map((product) => product.id));
    const deletedIds = existing
      .filter((product) => !nextIds.has(product.id))
      .map((product) => product.id);

    if (deletedIds.length) {
      await supabaseJson(
        `/rest/v1/products?id=in.(${deletedIds.map(encodeURIComponent).join(",")})`,
        {
          method: "DELETE",
          headers: { Prefer: "return=minimal" },
        },
      );
    }

    if (products.length) {
      await supabaseJson<ProductRow[]>(
        "/rest/v1/products?on_conflict=id",
        {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify(products.map(toProductRow)),
        },
      );
    }

    return;
  }

  await writeJsonFile(productsPath, products);
}

export async function readOrders() {
  if (isSupabaseEnabled()) {
    const rows = await supabaseJson<OrderRow[]>(
      "/rest/v1/orders?select=*&order=created_at.desc",
    );

    return rows.map(toOrder);
  }

  return readJsonFile<DemoOrder[]>(ordersPath, []);
}

export async function readPaidOrderItems() {
  if (isSupabaseEnabled()) {
    const rows = await supabaseJson<Array<Pick<OrderRow, "items">>>(
      "/rest/v1/orders?select=items&status=eq.paid",
    );

    return rows.flatMap((row) => row.items);
  }

  const orders = await readOrders();
  return orders
    .filter((order) => order.status === "paid")
    .flatMap((order) => order.items);
}

export async function writeOrders(orders: DemoOrder[]) {
  if (isSupabaseEnabled()) {
    if (orders.length) {
      await supabaseJson<OrderRow[]>("/rest/v1/orders?on_conflict=id", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(orders.map(toOrderRow)),
      });
    }

    return;
  }

  await writeJsonFile(ordersPath, orders);
}

export async function upsertOrder(order: DemoOrder) {
  if (isSupabaseEnabled()) {
    const [row] = await supabaseJson<OrderRow[]>("/rest/v1/orders?on_conflict=id", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(toOrderRow(order)),
    });

    return toOrder(row);
  }

  const orders = await readOrders();
  const existingIndex = orders.findIndex((item) => item.id === order.id);
  const nextOrders =
    existingIndex >= 0
      ? orders.map((item) => (item.id === order.id ? order : item))
      : [order, ...orders];

  await writeOrders(nextOrders);
  return order;
}
