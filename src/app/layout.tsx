import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Hospedá — Gestión Hotelera Simple",
    template: "%s | Hospedá",
  },
  description:
    "Sistema de gestión hotelera completo para Argentina. Reservas, check-in/out, facturación, limpieza, caja y reportes. Todo en un solo lugar. 30 días gratis.",
  keywords: [
    "gestión hotelera", "hotel software", "reservas online",
    "sistema hotelero", "hoteles Argentina", "hostel management",
    "check-in check-out", "facturación hotelera", "Hospedá",
  ],
  authors: [{ name: "Hospedá" }],
  creator: "Hospedá",
  metadataBase: new URL("https://hospeda.com"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "https://hospeda.com",
    siteName: "Hospedá",
    title: "Hospedá — Gestión Hotelera Simple",
    description:
      "La plataforma todo-en-uno para hoteles, hostels y alojamientos en Argentina. Reservas, facturación, caja y reportes en un solo lugar.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Hospedá — Gestión Hotelera Simple",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hospedá — Gestión Hotelera Simple",
    description:
      "Gestión hotelera completa. Reservas, facturación, caja y reportes. 30 días gratis.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏨</text></svg>",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}