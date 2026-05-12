import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";

import "./globals.css";

const sans = DM_Sans({
  variable: "--font-sans-plan",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-plan",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Biblioteca LP — plano de feria",
  description:
    "Plano interactivo con medidas reales, puestos de 1,50 m y base de datos local para el evento.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${sans.variable} ${mono.variable} min-h-screen bg-[#030712] text-neutral-100 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
