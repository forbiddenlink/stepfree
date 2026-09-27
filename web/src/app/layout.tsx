import type { Metadata, Viewport } from "next";
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
  title: "StepFree: the NYC subway without stairs",
  description:
    "Plan step-free subway trips in New York City using live MTA elevator outages, two years of monthly elevator reliability, and MTA accessibility policy.",
  metadataBase: new URL("https://stepfree-alpha.vercel.app"),
  openGraph: {
    title: "StepFree: the NYC subway without stairs",
    description:
      "Plan step-free subway trips in New York City using live MTA elevator outages, two years of monthly elevator reliability, and MTA accessibility policy.",
    url: "https://stepfree-alpha.vercel.app",
    siteName: "StepFree",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "StepFree - Step-free trips on the NYC subway with verified working elevators",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StepFree: the NYC subway without stairs",
    description:
      "Step-free trips on the New York City subway, with the verified working ADA elevators each trip depends on.",
    images: ["/og-image.svg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#111214" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
