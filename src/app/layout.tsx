import type { Metadata, Viewport } from "next";
import { Caveat, DM_Mono, DM_Sans, Fraunces } from "next/font/google";
import { Providers } from "./providers";
import { ServiceWorker } from "@/components/shell/ServiceWorker";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  style: ["normal", "italic"],
});
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });

export const metadata: Metadata = {
  title: "keepsake — a little box of memories",
  description: "Turn everyday photos into cosy, collaborative scrapbooks.",
  applicationName: "keepsake",
  // Lets iPhones run it full-screen from the home screen.
  appleWebApp: { capable: true, title: "keepsake", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // Older iOS versions only honour the Apple-prefixed tag.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#FAF5E9",
  width: "device-width",
  initialScale: 1,
  // Draw under the notch / home indicator; CSS pads with safe-area insets.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${dmSans.variable} ${caveat.variable} ${dmMono.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
        <ServiceWorker />
      </body>
    </html>
  );
}
