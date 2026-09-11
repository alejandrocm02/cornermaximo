'use client';

import Image from 'next/image';
import { useState } from 'react';

/** Keep an identically sized team mark when the provider image is unavailable. */
export function HistoryCrest({ name, url }: { name: string; url: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white p-1.5" title={name}>
      {url && failedUrl !== url ? (
        <Image src={url} alt={name} width={24} height={24} className="h-6 w-6 object-contain" onError={() => setFailedUrl(url)} />
      ) : (
        <span className="text-xs font-bold text-slate-700" aria-label={name}>{initials}</span>
      )}
    </span>
  );
}
