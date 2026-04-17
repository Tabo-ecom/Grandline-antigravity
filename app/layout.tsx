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
  icons: {
    icon: '/logos/grandline-isotipo.png',
    apple: '/logos/grandline-isotipo.png',
  },
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#0A0A0F" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/logos/grandline-isotipo.png" />
      </head>
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
