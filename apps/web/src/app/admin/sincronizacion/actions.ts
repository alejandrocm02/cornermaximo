'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  createSyncAdminSession,
  SYNC_ADMIN_COOKIE,
  verifySyncAdminSecret,
} from '@/lib/adminSession';

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
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/admin',
    maxAge: 4 * 60 * 60,
  });
  redirect('/admin/sincronizacion');
}

export async function endSyncDashboardSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SYNC_ADMIN_COOKIE);
  redirect('/admin/sincronizacion');
}
