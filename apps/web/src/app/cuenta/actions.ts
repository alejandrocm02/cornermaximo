'use server';

import { prisma } from '@futstats/db';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  createSession,
  deleteSession,
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from '@/lib/auth';

export interface AuthFormState {
  error: string | null;
  fields?: { email?: string };
}

const emailSchema = z.string().trim().email('Introduce un correo válido.').max(254);
const passwordSchema = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres.')
  .max(128, 'La contraseña no puede superar 128 caracteres.')
  .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value), {
    message: 'Incluye al menos una mayúscula, una minúscula y un número.',
  });

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmation: z.string(),
}).refine((value) => value.password === value.confirmation, {
  path: ['confirmation'],
  message: 'Las contraseñas no coinciden.',
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Introduce tu contraseña.').max(128),
});

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

async function failedLoginDelay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 550));
}

export async function registerAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = text(formData, 'email');
  const parsed = registerSchema.safeParse({
    email,
    password: text(formData, 'password'),
    confirmation: text(formData, 'confirmation'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos.', fields: { email } };
  }

  const normalizedEmail = normalizeEmail(parsed.data.email);
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
  if (existing != null) {
    return { error: 'Ya existe una cuenta con este correo.', fields: { email: normalizedEmail } };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    const user = await prisma.user.create({
      data: { email: normalizedEmail, passwordHash },
      select: { id: true },
    });
    await createSession(user.id);
  } catch (error) {
    const duplicate = typeof error === 'object' && error != null && 'code' in error && error.code === 'P2002';
    return {
      error: duplicate ? 'Ya existe una cuenta con este correo.' : 'No se pudo crear la cuenta. Inténtalo de nuevo.',
      fields: { email: normalizedEmail },
    };
  }

  redirect('/cuenta');
}

export async function loginAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = text(formData, 'email');
  const parsed = loginSchema.safeParse({ email, password: text(formData, 'password') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos.', fields: { email } };
  }

  const normalizedEmail = normalizeEmail(parsed.data.email);
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, passwordHash: true },
  });

  const valid = user != null && await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid || user == null) {
    await failedLoginDelay();
    return { error: 'Correo o contraseña incorrectos.', fields: { email: normalizedEmail } };
  }

  await createSession(user.id);
  redirect('/cuenta');
}

export async function logoutAction(): Promise<void> {
  await deleteSession();
  redirect('/');
}
