import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ApparelFlow ERP",
  description: "Cutting Operations & Gatekeeper Verification Terminal"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}