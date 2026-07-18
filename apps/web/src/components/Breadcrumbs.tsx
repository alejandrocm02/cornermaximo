import Link from 'next/link';

export interface Crumb {
  label: string;
  href?: string;
}

/** Migas de pan para páginas interiores. El último elemento es la página actual. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Migas de pan" className="text-xs text-pitch-muted">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link href="/" className="rounded outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-pitch-accent">
            Inicio
          </Link>
        </li>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              <span aria-hidden="true">/</span>
              {item.href != null && !isLast ? (
                <Link href={item.href} className="rounded outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-pitch-accent">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className={isLast ? 'text-white' : undefined}>
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
