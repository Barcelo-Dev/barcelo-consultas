import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Consultas | Barceló Guatemala City",
  description: "Panel de consulta de registros de huéspedes.",
  icons: { icon: "/icono.png" },
  robots: { index: false, follow: false }, // que no lo indexen buscadores
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Slab:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
