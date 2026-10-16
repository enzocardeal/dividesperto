import type { Metadata, Viewport } from "next";
import { strings } from "@/lib/strings";
import "./globals.css";

export const metadata: Metadata = {
  title: strings.app.name,
  description: strings.app.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-white text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
