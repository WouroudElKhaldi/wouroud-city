import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { personJsonLd, SITE_URL } from "./site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "The 3D portfolio of Wouroud El Khaldi, Mid-Senior Full Stack Software Engineer. Walk the city to explore skills, work, projects and hobbies.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Wouroud's City · Wouroud El Khaldi", template: "%s · Wouroud El Khaldi" },
  description,
  applicationName: "Wouroud's City",
  authors: [{ name: "Wouroud El Khaldi", url: SITE_URL }],
  creator: "Wouroud El Khaldi",
  keywords: ["Wouroud El Khaldi", "full stack developer", "software engineer", "Lebanon", "Tripoli", "React", "Next.js", "Laravel", "3D portfolio"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Wouroud's City",
    title: "Wouroud's City · Wouroud El Khaldi",
    description,
    url: "/",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: "Wouroud's City · Wouroud El Khaldi", description },
};

export const viewport: Viewport = {
  themeColor: "#1a103d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) add attributes to <body> before React loads */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd()) }} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
