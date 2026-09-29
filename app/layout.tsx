import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adsolution CRM",
  description: "Private agency account operations workspace.",
  icons: { icon: "/adsolution-icon.png", shortcut: "/adsolution-icon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
