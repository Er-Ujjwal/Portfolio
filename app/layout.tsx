import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import Snowfall from "@/components/Snowfall";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Ujjwal Rauniyar",
  description:
    "Personal portfolio of Ujjwal Rauniyar — software engineer, DSA enthusiast, full-stack developer, and AI/ML explorer.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} antialiased`}
    >
      <body>
        <div className="background-gradient" aria-hidden="true" />
        <div id="snow-container" className="snow-container" aria-hidden="true">
          <Snowfall />
        </div>
        {children}
      </body>
    </html>
  );
}
