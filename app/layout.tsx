import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { initializeApp } from "@/lib/init";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

// 初始化应用（仅在服务器端）
if (typeof window === 'undefined') {
  initializeApp();
}

export const metadata: Metadata = {
  title: "Hot Topics AI - Real-Time News Briefings",
  description: "基于 AI 的实时热点简报生成系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

