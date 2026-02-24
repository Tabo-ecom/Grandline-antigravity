import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ProtectedLayout from "@/components/layout/ProtectedLayout";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GRAND LINE v8.0 — Command Center",
  description: "Advanced analytics platform for e-commerce and dropshipping.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased selection:bg-[#d75c33]/30`}
        suppressHydrationWarning
      >
        <ProtectedLayout>
          {children}
        </ProtectedLayout>
      </body>
    </html>
  );
}
