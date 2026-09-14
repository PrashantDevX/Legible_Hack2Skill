import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Legible — Understand any legal document before you sign it",
  description:
    "Upload a lease, contract, or agreement. Legible explains it in plain language, flags potential concerns, and prepares questions to ask a lawyer. Informational assistance only — not legal advice.",
};

// Sets the theme before first paint to avoid a flash of the wrong theme.
const themeInit = `try{var t=localStorage.getItem("legible-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.setAttribute("data-theme","dark")}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
