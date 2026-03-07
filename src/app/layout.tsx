import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Schibsted_Grotesk, Spectral } from "next/font/google";
import "./globals.css";

const spectral = Spectral({
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const schibstedGrotesk = Schibsted_Grotesk({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Midnight Editorial Desk",
  description: "Dark editorial analyst workstation for AI lab releases and hyperscaler market reactions.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ece6db" },
    { media: "(prefers-color-scheme: dark)", color: "#07111f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spectral.variable} ${schibstedGrotesk.variable} ${ibmPlexMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
