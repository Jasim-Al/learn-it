import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ['normal', 'italic'],
  weight: ['400', '500', '600', '700'],
});

import { AuthProvider } from "@/components/AuthProvider";

import { AppSidebar } from "@/components/AppSidebar";

export const metadata: Metadata = {
  title: "LearnIt",
  description: "AI-powered personalized courses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} antialiased selection:bg-orange-100 selection:text-orange-900 bg-white text-zinc-900`}
      >
        <AuthProvider>
          <div className="flex min-h-screen w-full bg-background">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-h-screen">
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
