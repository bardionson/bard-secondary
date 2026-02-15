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
  title: "Bard Ionson Secondary Market",
  description: "A curated gallery of NFTs created by Bard Ionson.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <div className="flex-1">
          {children}
        </div>
        <footer className="py-8 bg-neutral-900 text-neutral-400 text-center text-sm mt-auto border-t border-neutral-800">
          <p>&copy; {new Date().getFullYear()} Bard Ionson. All rights reserved.</p>
          <p className="mt-2 text-xs text-neutral-600">
            Showcasing art from SuperRare, KnownOrigin, MakersPlace, and Async Art.
          </p>
        </footer>
      </body>
    </html>
  );
}
