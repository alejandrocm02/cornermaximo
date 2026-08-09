import { createClient } from 'npm:@supabase/supabase-js@2.110.5';
import webpush from 'npm:web-push@3.6.7';

type Preference = {
  user_id: string;
  result_alerts: boolean;
  live_alerts: boolean;
  upcoming_alerts: boolean;
  watchlist_players: boolean;
  push_enabled: boolean;
};

type Subscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type Alert = {
  id: string;
  type: 'RESULT' | 'LIVE' | 'UPCOMING';
  matchId: number;
  kickoffAt: string;
  competition: { name: string; slug: string };
  home: { name: string; goals: number | null } | null;
  away: { name: string; goals: number | null } | null;
};

type Feed = { alerts: Alert[] };

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function eligible(alert: Alert, preference: Preference, now: number): boolean {
  const kickoff = new Date(alert.kickoffAt).getTime();
  if (alert.type === 'LIVE') return preference.live_alerts;
  if (alert.type === 'RESULT') {
    return preference.result_alerts && kickoff <= now && kickoff >= now - 18 * 60 * 60 * 1000;
  }
  return preference.upcoming_alerts && kickoff >= now && kickoff <= now + 6 * 60 * 60 * 1000;
}

function notification(alert: Alert) {
  const home = alert.home?.name ?? 'Local';
  const away = alert.away?.name ?? 'Visitante';
  const score = `${alert.home?.goals ?? '—'}–${alert.away?.goals ?? '—'}`;

  if (alert.type === 'LIVE') {
    return {
      title: `🔴 En directo · ${home} ${score} ${away}`,
      body: alert.competition.name,
      tag: alert.id,
      url: `/partidos/${alert.matchId}`,
    };
  }
  if (alert.type === 'RESULT') {
    return {
      title: `Resultado · ${home} ${score} ${away}`,
      body: alert.competition.name,
      tag: alert.id,
      url: `/partidos/${alert.matchId}`,
    };
  }
  return {
    title: `Próximo partido · ${home} vs ${away}`,
    body: `${alert.competition.name} · ${new Date(alert.kickoffAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })}`,
    tag: alert.id,
    url: `/partidos/${alert.matchId}`,
  };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) return new Response('Runtime not configured', { status: 500 });

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: runtimeRows, error: runtimeError } = await supabase.rpc('get_push_runtime_config');
  const runtime = runtimeRows?.[0];
  if (runtimeError || !runtime) return new Response('Push runtime config missing', { status: 503 });

  const suppliedSecret = request.headers.get('x-futstats-cron') ?? '';
  if (!suppliedSecret || suppliedSecret !== runtime.cron_secret) return new Response('Unauthorized', { status: 401 });

  const { data: publicConfig, error: publicConfigError } = await supabase
    .from('push_public_config')
    .select('vapid_public_key')
    .eq('singleton', true)
    .single();
  if (publicConfigError || !publicConfig?.vapid_public_key) return new Response('VAPID public key missing', { status: 503 });

  webpush.setVapidDetails(
    'mailto:admin@futstats.app',
    publicConfig.vapid_public_key,
    runtime.vapid_private_key,
  );

  const { data: preferences, error: preferencesError } = await supabase
    .from('user_alert_preferences')
    .select('user_id,result_alerts,live_alerts,upcoming_alerts,watchlist_players,push_enabled')
    .eq('push_enabled', true);
  if (preferencesError) return new Response(preferencesError.message, { status: 500 });

  const userIds = (preferences ?? []).map((item) => item.user_id);
  if (userIds.length === 0) return Response.json({ users: 0, sent: 0 });

  const [subscriptionsResult, favoritesResult, watchlistsResult, deliveriesResult] = await Promise.all([
    supabase.from('user_push_subscriptions').select('id,user_id,endpoint,p256dh,auth').in('user_id', userIds),
    supabase.from('user_favorites').select('user_id,kind,entity_slug').in('user_id', userIds),
    supabase.from('user_watchlist_players').select('user_id,player_slug').in('user_id', userIds),
    supabase
      .from('user_push_deliveries')
      .select('user_id,alert_id')
      .in('user_id', userIds)
      .gte('delivered_at', new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);

  const firstError = subscriptionsResult.error ?? favoritesResult.error ?? watchlistsResult.error ?? deliveriesResult.error;
  if (firstError) return new Response(firstError.message, { status: 500 });

  const subscriptions = (subscriptionsResult.data ?? []) as Subscription[];
  const delivered = new Set((deliveriesResult.data ?? []).map((item) => `${item.user_id}:${item.alert_id}`));
  let sent = 0;
  let staleRemoved = 0;
  const now = Date.now();

  for (const preference of (preferences ?? []) as Preference[]) {
    const userSubscriptions = subscriptions.filter((item) => item.user_id === preference.user_id);
    if (userSubscriptions.length === 0) continue;

    const favorites = (favoritesResult.data ?? []).filter((item) => item.user_id === preference.user_id);
    const favoritePlayers = favorites.filter((item) => item.kind === 'player').map((item) => item.entity_slug);
    const teams = favorites.filter((item) => item.kind === 'team').map((item) => item.entity_slug);
    const competitions = favorites.filter((item) => item.kind === 'competition').map((item) => item.entity_slug);
    const watchlistPlayers = preference.watchlist_players
      ? (watchlistsResult.data ?? []).filter((item) => item.user_id === preference.user_id).map((item) => item.player_slug)
      : [];

    const params = new URLSearchParams({
      players: unique([...favoritePlayers, ...watchlistPlayers]).slice(0, 20).join(','),
      teams: unique(teams).slice(0, 20).join(','),
      competitions: unique(competitions).slice(0, 20).join(','),
    });
    if (![...params.values()].some(Boolean)) continue;

    let feed: Feed;
    try {
      const response = await fetch(`${runtime.app_url.replace(/\/$/, '')}/api/alertas?${params.toString()}`, {
        headers: { 'User-Agent': 'FutStats-Push/1.0' },
      });
      if (!response.ok) continue;
      feed = await response.json() as Feed;
    } catch {
      continue;
    }

    const candidates = feed.alerts
      .filter((alert) => eligible(alert, preference, now))
      .filter((alert) => !delivered.has(`${preference.user_id}:${alert.id}`))
      .sort((a, b) => {
        const priority = { LIVE: 0, RESULT: 1, UPCOMING: 2 } as const;
        return priority[a.type] - priority[b.type] || new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime();
      })
      .slice(0, 2);

    for (const alert of candidates) {
      const payload = JSON.stringify(notification(alert));
      let deliveredToDevice = false;

      for (const subscription of userSubscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
            { TTL: alert.type === 'LIVE' ? 180 : 3600, urgency: alert.type === 'LIVE' ? 'high' : 'normal' },
          );
          deliveredToDevice = true;
          sent += 1;
        } catch (reason) {
          const statusCode = typeof reason === 'object' && reason != null && 'statusCode' in reason
            ? Number((reason as { statusCode?: unknown }).statusCode)
            : null;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from('user_push_subscriptions').delete().eq('id', subscription.id);
            staleRemoved += 1;
          }
        }
      }

      if (deliveredToDevice) {
        await supabase.from('user_push_deliveries').upsert({
          user_id: preference.user_id,
          alert_id: alert.id,
          delivered_at: new Date().toISOString(),
        }, { onConflict: 'user_id,alert_id' });
        delivered.add(`${preference.user_id}:${alert.id}`);
      }
    }
  }

  return Response.json({ users: userIds.length, subscriptions: subscriptions.length, sent, staleRemoved });
});
