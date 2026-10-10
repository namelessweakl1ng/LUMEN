import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ApplicationShell } from "@/components/layout/application-shell";
import { ThemeProvider } from "@/components/layout/theme-provider";

export const metadata: Metadata = {
  title: "Lumen — Search, without the noise.",
  description: "Independent metasearch with local research workspaces.",
  referrer: "no-referrer",
  robots: {
    // Lumen is a private tool. Don't let search engines index search
    // result pages or the homepage.
    index: false,
    follow: false,
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground min-h-screen">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ApplicationShell>{children}</ApplicationShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
