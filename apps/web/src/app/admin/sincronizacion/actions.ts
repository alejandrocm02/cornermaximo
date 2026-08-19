'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  createSyncAdminRateLimitKey,
  createSyncAdminSession,
  SYNC_ADMIN_COOKIE,
  verifySyncAdminSecret,
} from '@/lib/adminSession';
import { createAdminClient } from '@/lib/supabase/admin';

const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/admin',
  priority: 'high' as const,
};

export async function authenticateSyncDashboard(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const validSecret = verifySyncAdminSecret(token);
  const requestHeaders = await headers();
  const clientAddress = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rateLimitKey = createSyncAdminRateLimitKey(clientAddress);
  if (rateLimitKey == null) {
    redirect('/admin/sincronizacion?error=configuracion');
  }

  let retryAfter = 0;
  try {
    const { data, error } = await createAdminClient().rpc('consume_admin_auth_attempt', {
      p_key_hash: rateLimitKey,
      p_succeeded: validSecret,
    });
    if (error || typeof data !== 'number') throw error ?? new Error('Invalid rate-limit response.');
    retryAfter = data;
  } catch {
    redirect('/admin/sincronizacion?error=configuracion');
  }

  if (retryAfter > 0) {
    redirect('/admin/sincronizacion?error=limite');
  }

  if (!validSecret) {
    redirect('/admin/sincronizacion?error=credenciales');
  }

  const session = createSyncAdminSession();
  if (session == null) {
    redirect('/admin/sincronizacion?error=configuracion');
  }

  const cookieStore = await cookies();
  cookieStore.set(SYNC_ADMIN_COOKIE, session, {
    ...ADMIN_COOKIE_OPTIONS,
    maxAge: 4 * 60 * 60,
  });
  redirect('/admin/sincronizacion');
}

export async function endSyncDashboardSession() {
  const cookieStore = await cookies();
  cookieStore.set(SYNC_ADMIN_COOKIE, '', {
    ...ADMIN_COOKIE_OPTIONS,
    maxAge: 0,
  });
  redirect('/admin/sincronizacion');
}
