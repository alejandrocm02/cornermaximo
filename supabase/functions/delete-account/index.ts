import { createClient } from 'npm:@supabase/supabase-js@2.110.5';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  let body: { confirmation?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  if (body.confirmation !== 'ELIMINAR') return json({ error: 'Confirmation required' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKeysRaw = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS');
  const legacyAnon = Deno.env.get('SUPABASE_ANON_KEY');
  const legacyServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl) return json({ error: 'Runtime not configured' }, 500);

  const publishableKey = publishableKeysRaw
    ? (JSON.parse(publishableKeysRaw) as Record<string, string>).default
    : legacyAnon;
  const secretKey = secretKeysRaw
    ? (JSON.parse(secretKeysRaw) as Record<string, string>).default
    : legacyServiceRole;

  if (!publishableKey || !secretKey) return json({ error: 'Runtime not configured' }, 500);

  const token = authHeader.slice('Bearer '.length);
  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) return json({ error: 'Unauthorized' }, 401);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('delete-account failed', { userId: user.id, code: deleteError.code });
    return json({
      error: 'No se pudo eliminar la cuenta. Si tienes archivos propios almacenados, deben eliminarse antes.',
    }, 409);
  }

  return json({ deleted: true });
});
