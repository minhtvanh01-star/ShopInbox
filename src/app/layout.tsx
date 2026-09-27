import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Nexo",
  applicationName: "Nexo",
  description: "Hộp thư đa kênh cho cửa hàng — trả lời tin nhắn và lưu đơn hàng.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${plusJakarta.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <a href="#main-content" className="skip-link">
          Bỏ qua đến nội dung chính
        </a>
        {children}
      </body>
    </html>
  );
}
