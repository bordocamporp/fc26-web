import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
    default: "Bordo Campo",
    template: "%s | Bordo Campo",
  },
  description: "Bordo Campo - Football, Gaming ed Esports",
  icons: {
    icon: "/logo-bordo-campo.png",
    shortcut: "/logo-bordo-campo.png",
    apple: "/logo-bordo-campo.png",
  },
  openGraph: {
    title: "Bordo Campo",
    description: "Football, Gaming ed Esports",
    siteName: "Bordo Campo",
    images: ["/logo-bordo-campo.png"],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
