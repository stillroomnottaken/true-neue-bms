import type { Metadata, Viewport } from "next";
import "./site.css";
import "./admin.css";

export const metadata: Metadata = {
  title: "BMS Admin",
  description: "BMS website administration",
  robots: { index: false, follow: false },
  icons: { icon: "/assets/img/favicon.svg" },
};
export const viewport: Viewport = { themeColor: "#90C207" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="js">
      <body>{children}</body>
    </html>
  );
}
