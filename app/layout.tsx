import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eibar Femenino · Staff",
  description: "Panel de temporada, resultados y probabilidades para el cuerpo técnico.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
