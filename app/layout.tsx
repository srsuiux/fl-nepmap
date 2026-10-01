import "./globals.css";
import RegisterSW from "@/components/RegisterSW";
import LangProvider from "@/components/LangProvider";

export const metadata = {
  title: "Nepal Flood & Landslide Watch",
  description: "Official flood and landslide reports and river warnings near you in Nepal.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Nepal Watch", statusBarStyle: "default" as const },
};
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#b3261e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><LangProvider>{children}</LangProvider><RegisterSW /></body>
    </html>
  );
}
