import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Adsolution", template: "%s · Adsolution" },
  description: "Agency ad accounts management — Turn Clicks Into Profits",
  icons: { icon: "/logo-icon.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#078E82" };

// Picks the theme before first paint when the user never chose one (follows the OS).
const themeScript = `(function(){try{var d=document.documentElement;if(!d.dataset.theme){d.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("theme")?.value;
  return (
    <html lang="en" data-theme={theme === "dark" || theme === "light" ? theme : undefined} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
