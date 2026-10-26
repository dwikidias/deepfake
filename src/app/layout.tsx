import type { Metadata } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import "lenis/dist/lenis.css";
import "./globals.css";
import SmoothScrollProvider from "@/components/SmoothScrollProvider";

const cormorant = localFont({
  src: "./fonts/stk-bureau-serif-light.CW_p4tq7.woff2",
  variable: "--font-cormorant",
  display: "swap",
});

const jakarta = localFont({
  src: [
    {
      path: "./fonts/retorika-medium.BMb6MC4j.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/retorika-semibold.D_3siNFs.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-jakarta",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nominal Forensics | Deepfake Video Frame Inspector",
  description: "Pemeriksaan keaslian frame video berbasis Vision Transformer dan arsip verifikasi publik.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#FDFFF8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${cormorant.variable} ${jakarta.variable} ${jetbrains.variable}`}
    >
      <body className="antialiased selection:bg-nominal-teal selection:text-nominal-ink">
        <SmoothScrollProvider>
          {children}
        </SmoothScrollProvider>
      </body>
    </html>
  );
}