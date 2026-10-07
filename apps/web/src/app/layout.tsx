import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import { DemoChrome } from '@/components/demo/DemoChrome';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { store } from '@/config/store';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const poppins = Poppins({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-poppins' });

// Absolute base for social-share images. Vercel sets VERCEL_PROJECT_PRODUCTION_URL at build time.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${store.name} · ${store.tagline}`, template: `%s · ${store.name}` },
  description: store.description,
  openGraph: { images: ['/images/hero.jpg'] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body className="flex min-h-screen flex-col">
        <DemoChrome />
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
