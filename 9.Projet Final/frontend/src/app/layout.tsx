
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RaibowKitAndWagMiProvider from "../providers/RaibowKitAndWagMiProvider";
import Layout from "@/components/shared/Layout";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PatriDeFi",
  description: "Tokenisation de votre napoléon d'or avec PatriDeFi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
      <RaibowKitAndWagMiProvider>
        <Layout>
          {children}
        </Layout>
      </RaibowKitAndWagMiProvider>
      </body>
    </html>
  );
}
