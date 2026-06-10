import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppErrorBoundary } from "@/components/app-error-boundary";

export const metadata: Metadata = {
  title: "BasedOne",
  description:
    "A Base App-first soulbound mint flow that links a source wallet to a target EOA on Base.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <AppErrorBoundary>
          <Providers>{children}</Providers>
        </AppErrorBoundary>
      </body>
    </html>
  );
}
