import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "活动下单系统",
  description: "扫码下单、付款截图审核和库存管理",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
