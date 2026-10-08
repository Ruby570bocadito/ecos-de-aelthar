import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ecos de Aelthar — Demo jugable (RPG 2D)",
  description:
    "Demo vertical slice del RPG 2D de acción Ecos de Aelthar: explora el Valle de Lunaris, el Bosque Susurrante y la Cripta del Primer Canto, domina el combate táctico y alterna entre el presente y el pasado de Velmora.",
  keywords: ["Ecos de Aelthar", "RPG 2D", "pixel art", "action RPG", "demo", "videojuego"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-[#0a0b12] text-stone-200">
        {children}
      </body>
    </html>
  );
}
