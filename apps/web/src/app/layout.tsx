import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { CookieNotice } from '@/components/CookieNotice';
import { FavoriteHomeBanner } from '@/components/FavoriteHomeBanner';
import { FavoritesAccountSync } from '@/components/FavoritesAccountSync';
import { MainNav } from '@/components/MainNav';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { SiteFooter } from '@/components/SiteFooter';
import './globals.css';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const fontSans = Inter({ subsets:['latin'], display:'swap', variable:'--font-sans' });
const fontDisplay = Space_Grotesk({ subsets:['latin'], display:'swap', weight:['500','600','700'], variable:'--font-display' });

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: { default:'CornerMaximo | Sports Intelligence', template:'%s | CornerMaximo' },
  description:'Partidos, estadísticas, rankings, scouting y análisis de fútbol. Tus datos. Tu ventaja.',
  applicationName:'CornerMaximo',
  openGraph:{ type:'website', siteName:'CornerMaximo', locale:'es_ES', title:'CornerMaximo | Sports Intelligence', description:'Partidos. Datos. Scouting. Todo el fútbol en un solo lugar.' },
  twitter:{ card:'summary_large_image', title:'CornerMaximo | Sports Intelligence', description:'Tu deporte. Tus datos. Tu ventaja.' },
};
export const viewport: Viewport = { themeColor:'#05070B', colorScheme:'dark' };
const websiteJsonLd = { '@context':'https://schema.org', '@type':'WebSite', name:'CornerMaximo', alternateName:'CM Sports Intelligence', url:BASE_URL, inLanguage:'es' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es" className={`${fontSans.variable} ${fontDisplay.variable}`}><body className="min-h-dvh pb-16 md:pb-0">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(websiteJsonLd)}} />
    <FavoritesAccountSync />
    <a href="#contenido" className="sr-only z-50 rounded-lg bg-pitch-accent px-4 py-2 font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4">Saltar al contenido principal</a>
    <header className="sticky top-0 z-30 border-b border-pitch-border/70 bg-pitch-bg/90 backdrop-blur-xl"><MainNav /><div aria-hidden="true" className="fs-rule absolute inset-x-0 bottom-0" /></header>
    <FavoriteHomeBanner />
    <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 py-7 outline-none sm:px-6 lg:px-8 lg:py-10">{children}</main>
    <SiteFooter /><MobileBottomNav /><CookieNotice />
  </body></html>;
}
