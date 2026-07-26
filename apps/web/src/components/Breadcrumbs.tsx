import Link from 'next/link';

export interface Crumb {
  label: string;
  href?: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/** Migas de pan para páginas interiores, con datos estructurados BreadcrumbList. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: BASE_URL },
      ...items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: item.label,
        ...(item.href != null ? { item: `${BASE_URL}${item.href}` } : {}),
      })),
    ],
  };

  return (
    <nav aria-label="Migas de pan" className="text-2xs text-pitch-muted">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="rounded py-1 transition-colors hover:text-white">
            Inicio
          </Link>
        </li>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="text-pitch-border-strong">
                /
              </span>
              {item.href != null && !isLast ? (
                <Link href={item.href} className="rounded py-1 transition-colors hover:text-white">
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={isLast ? 'font-medium text-pitch-subtle' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
