import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["300", "400", "500", "700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sintonia 360 X GHVE Eventos | Venda de Ingressos",
  description: "Garanta seu ingresso para o maior festival eletrônico e audiovisual da região. Experiência 360° com som, luz e sintonia incomparáveis.",
  keywords: ["Sintonia 360", "GHVE Eventos", "Ingressos", "Show", "Festival", "Balada", "Música Eletrônica"],
  openGraph: {
    title: "Sintonia 360 X GHVE Eventos",
    description: "Garanta seu ingresso para a maior experiência eletrônica e audiovisual em 360 graus.",
    type: "website",
  },
};

import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-white font-sans selection:bg-primary selection:text-black">
        <Toaster theme="dark" position="top-center" richColors />
        {children}
      </body>
    </html>
  );
}
