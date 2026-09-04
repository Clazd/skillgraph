import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: { default: "SkillGraph — Map what you can do", template: "%s · SkillGraph" },
  description: "Explore 1,000 practical human skills as one connected map, then mark the territory you can already navigate.",
};

export const viewport: Viewport = { themeColor: "#07101f", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        {children}
        <footer className="site-footer">
          <Link href="/">SkillGraph</Link><span>Self-reported. Verifies nothing.</span>
          <nav aria-label="Footer"><Link href="/about">About</Link><Link href="/contribute">Contribute</Link><a href="https://github.com/Clazd/skillgraph">GitHub</a></nav>
        </footer>
      </body>
    </html>
  );
}
