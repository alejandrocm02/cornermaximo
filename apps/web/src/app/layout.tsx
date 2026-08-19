import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/space-grotesk/wght.css';
import { CookieNotice } from '@/components/CookieNotice';
import { CspNonceProvider } from '@/components/CspNonceProvider';
import { FavoriteHomeBanner } from '@/components/FavoriteHomeBanner';
import { FavoritesAccountSync } from '@/components/FavoritesAccountSync';
import { JsonLd } from '@/components/JsonLd';
import { MainNav } from '@/components/MainNav';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { SiteFooter } from '@/components/SiteFooter';
import { getSiteUrl } from '@/lib/site-url';
import './globals.css';

const BASE_URL = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: { default:'CornerMaximo | Sports Intelligence', template:'%s | CornerMaximo' },
  description:'Partidos, estadísticas, rankings, scouting y análisis de fútbol. Tus datos. Tu ventaja.',
  applicationName:'CornerMaximo',
  openGraph:{
    type:'website',
    siteName:'CornerMaximo',
    locale:'es_ES',
    title:'CornerMaximo | Sports Intelligence',
    description:'Partidos. Datos. Scouting. Todo el fútbol en un solo lugar.',
    images:[{ url:'/opengraph-image', width:1200, height:630, alt:'CornerMaximo Sports Intelligence' }],
  },
  twitter:{
    card:'summary_large_image',
    title:'CornerMaximo | Sports Intelligence',
    description:'Tu deporte. Tus datos. Tu ventaja.',
    images:['/opengraph-image'],
  },
};
export const viewport: Viewport = { themeColor:'#05070B', colorScheme:'dark' };
const websiteJsonLd = { '@context':'https://schema.org', '@type':'WebSite', name:'CornerMaximo', alternateName:'CM Sports Intelligence', url:BASE_URL, inLanguage:'es' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return <html lang="es"><body className="min-h-dvh pb-16 md:pb-0">
    <CspNonceProvider nonce={nonce}>
    <JsonLd data={websiteJsonLd} />
    <FavoritesAccountSync />
    <a href="#contenido" className="sr-only z-50 rounded-lg bg-pitch-accent px-4 py-2 font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4">Saltar al contenido principal</a>
    <header className="sticky top-0 z-30 border-b border-pitch-border/70 bg-pitch-bg/90 backdrop-blur-xl"><MainNav /><div aria-hidden="true" className="fs-rule absolute inset-x-0 bottom-0" /></header>
    <FavoriteHomeBanner />
    <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 py-7 outline-none sm:px-6 lg:px-8 lg:py-10">{children}</main>
    <SiteFooter /><MobileBottomNav /><CookieNotice />
    </CspNonceProvider>
  </body></html>;
}
