import Link from 'next/link';

/**
 * Cabecera de sección reutilizable: título con jerarquía consistente y un
 * enlace opcional de "ver más" alineado a la derecha.
 */
export function SectionHeader({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        {eyebrow != null && (
          <p className="fs-eyebrow">
            <span aria-hidden="true" className="h-1 w-4 rounded-full bg-grad-brand" />
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 text-xl font-bold sm:text-2xl">{title}</h2>
      </div>
      {action != null && (
        <Link
          href={action.href}
          className="shrink-0 rounded-lg text-sm font-medium text-pitch-accent transition-colors hover:text-white"
        >
          {action.label} <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
