import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const userId = user.id;
  const [profile, favorites, watchlists, watchlistPlayers, alertPreferences, alertReads, pushSubscriptions, pushDeliveries, appState] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_favorites').select('*').eq('user_id', userId).order('added_at'),
    supabase.from('user_watchlists').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('user_watchlist_players').select('*').eq('user_id', userId).order('added_at'),
    supabase.from('user_alert_preferences').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_alert_reads').select('*').eq('user_id', userId).order('read_at'),
    supabase.from('user_push_subscriptions').select('id,user_id,endpoint,user_agent,created_at,updated_at').eq('user_id', userId).order('created_at'),
    supabase.from('user_push_deliveries').select('*').eq('user_id', userId).order('delivered_at'),
    supabase.from('user_app_state').select('state_key,payload,revision,updated_at').eq('user_id', userId).order('state_key'),
  ]);

  const queryError = [profile, favorites, watchlists, watchlistPlayers, alertPreferences, alertReads, pushSubscriptions, pushDeliveries, appState]
    .map((result) => result.error)
    .find(Boolean);

  if (queryError) {
    return NextResponse.json({ error: 'No se pudo preparar la exportación' }, { status: 500 });
  }

  const exportedAt = new Date().toISOString();
  const payload = {
    format: 'CornerMaximo personal data export',
    version: 1,
    exportedAt,
    account: {
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
      createdAt: user.created_at,
      updatedAt: user.updated_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      userMetadata: user.user_metadata ?? {},
    },
    profile: profile.data,
    favorites: favorites.data ?? [],
    watchlists: watchlists.data ?? [],
    watchlistPlayers: watchlistPlayers.data ?? [],
    alertPreferences: alertPreferences.data,
    alertReads: alertReads.data ?? [],
    pushSubscriptions: pushSubscriptions.data ?? [],
    pushDeliveries: pushDeliveries.data ?? [],
    appState: appState.data ?? [],
    note: 'Los datos deportivos públicos de CornerMaximo no forman parte de esta exportación porque no son datos personales de la cuenta. Las preferencias exclusivamente locales del navegador tampoco se conservan en el servidor.',
  };

  const date = exportedAt.slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="cornermaximo-datos-${date}.json"`,
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
