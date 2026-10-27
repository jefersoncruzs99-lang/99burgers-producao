import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Etiquetas 99",
  description: "Etiquetas de validade da Nove Nove Burgers.",
  manifest: "/etiquetas.webmanifest",
  appleWebApp: { capable: true, title: "Etiquetas 99", statusBarStyle: "black" },
  icons: { icon: "/icone-etiquetas-192.png", apple: "/icone-etiquetas-192.png" },
};

export default function EtiquetasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
