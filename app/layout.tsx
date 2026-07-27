import type { Metadata } from "next";
import "./globals.css";
import "./portal-theme.css";

export const metadata: Metadata = {
  title: "Medical Centre Portal",
  description: "Wayamba University of Sri Lanka",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="app-body sidebar-theme-rail">
        {children}
      </body>
    </html>
  );
}
