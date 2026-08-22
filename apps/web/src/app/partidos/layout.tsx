import { LiveScoreboardController } from '@/components/LiveScoreboardController';

export default function MatchesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LiveScoreboardController />
      {children}
    </>
  );
}
