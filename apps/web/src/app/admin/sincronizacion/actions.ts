'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  createSyncAdminSession,
  SYNC_ADMIN_COOKIE,
  verifySyncAdminSecret,
} from '@/lib/adminSession';

const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/admin',
  priority: 'high' as const,
};

export async function authenticateSyncDashboard(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  if (!verifySyncAdminSecret(token)) {
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
