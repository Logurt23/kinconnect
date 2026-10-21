import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "KinConnect", template: "%s · KinConnect" },
  description: "Private family app.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#faf7f2", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
