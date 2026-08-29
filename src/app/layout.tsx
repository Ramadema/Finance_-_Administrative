import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plata — tus finanzas, claras",
  description:
    "Dashboard personal de gastos. Subís el Excel del banco y ves a dónde va tu plata. Todo local, nada sale de tu navegador.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

/** Aplica el tema guardado antes del primer paint, para que no parpadee. */
const INIT_TEMA = `
try {
  var t = localStorage.getItem('tema');
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INIT_TEMA }} />
      </head>
      <body className="plano-textura min-h-screen antialiased">{children}</body>
    </html>
  );
}
