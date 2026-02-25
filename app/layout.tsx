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
  title: "GRAND LINE — Command Center para E-commerce COD",
  description: "Plataforma todo-en-uno para gestionar tu negocio de dropshipping COD en Latinoam\u00e9rica. Analytics, publicidad, reportes y automatizaci\u00f3n con IA.",
  metadataBase: new URL("https://grandline.com.co"),
  openGraph: {
    title: "GRAND LINE — Command Center para E-commerce COD",
    description: "Gestiona tu negocio de dropshipping COD con analytics avanzados, automatizaci\u00f3n de publicidad y reportes con IA.",
    url: "https://grandline.com.co",
    siteName: "GRAND LINE",
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GRAND LINE — Command Center para E-commerce COD",
    description: "Plataforma todo-en-uno para dropshipping COD en Latinoam\u00e9rica.",
  },
  robots: {
    index: true,
    follow: true,
  },
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
