export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

export type OrderStatus = "pending" | "paid" | "rejected";

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  accent: string;
  isActive: boolean;
};

export type DemoOrder = {
  id: string;
  createdAt: string;
  customerName: string;
  contact: string;
  note: string;
  items: CartItem[];
  total: number;
  screenshotName: string;
  screenshotUrl: string;
  status: OrderStatus;
  feishuRecordId?: string;
  feishuSyncStatus?: "skipped" | "synced" | "failed";
  feishuSyncMessage?: string;
};
