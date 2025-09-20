import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ultimate SEO - Comprehensive SEO Platform",
  description: "Boost your search engine rankings with our comprehensive SEO platform. Track keywords, analyze competitors, monitor backlinks, and generate detailed reports.",
  keywords: ["SEO", "search engine optimization", "keyword tracking", "competitor analysis", "backlink monitoring", "SEO reports"],
  authors: [{ name: "Ultimate SEO" }],
  creator: "Ultimate SEO Platform",
  publisher: "Ultimate SEO Platform",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://ultimateseo.com",
    title: "Ultimate SEO - Comprehensive SEO Platform",
    description: "Boost your search engine rankings with our comprehensive SEO platform. Track keywords, analyze competitors, monitor backlinks, and generate detailed reports.",
    siteName: "Ultimate SEO",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ultimate SEO - Comprehensive SEO Platform",
    description: "Boost your search engine rankings with our comprehensive SEO platform. Track keywords, analyze competitors, monitor backlinks, and generate detailed reports.",
    creator: "@ultimateseo",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${robotoMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
