import { LiveMatchTicker } from '@/components/LiveMatchTicker';
import { MatchAdvancedOverview } from '@/components/MatchAdvancedOverview';
import { getMatchDetail } from '@/lib/matches';

function parseMatchId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export default async function MatchDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = parseMatchId(rawId);
  const match = id == null ? null : await getMatchDetail(id);

  return (
    <div className="space-y-10">
      {match != null && (
        <div className="flex justify-end">
          <LiveMatchTicker matchId={match.id} initialStatus={match.status} kickoffAt={match.kickoffAt} />
        </div>
      )}
      {children}
      {match != null && <MatchAdvancedOverview match={match} />}
    </div>
  );
}
