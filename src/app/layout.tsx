import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/components/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Formu — Free IGCSE Further Pure Maths Revision",
  description: "Free revision platform for Pearson Edexcel IGCSE Further Pure Mathematics (4PM1). Question bank, quizzes, mock exams, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="py-10 text-center text-xs text-muted/50">
          <p>formu · not affiliated with Pearson or Edexcel</p>
        </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
