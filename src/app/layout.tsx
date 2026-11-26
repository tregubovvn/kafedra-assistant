import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Цифровой помощник зав. кафедрой",
  description:
    "Ассистент заведующего кафедрой «Производственный менеджмент» СГТУ имени Гагарина Ю.А.: поручения, замены, расписание, журнал работ.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b6b45",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground min-h-screen">
        {/* Настройки Supabase и общий пароль — правятся на сервере без пересборки */}
        <Script src={`${basePath}/config.js`} strategy="beforeInteractive" />
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
