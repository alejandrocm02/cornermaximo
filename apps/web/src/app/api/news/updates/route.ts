/** GET /api/news/updates?since=ISO — nº de noticias nuevas desde esa fecha (para el aviso en vivo). */
import { prisma } from '@futstats/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sinceRaw = url.searchParams.get('since');
  const since = sinceRaw != null ? new Date(sinceRaw) : null;
  if (since == null || Number.isNaN(since.getTime())) {
    return NextResponse.json({ count: 0 });
  }
  const count = await prisma.newsItem.count({ where: { createdAt: { gt: since } } });
  return NextResponse.json({ count });
}
