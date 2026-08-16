import { createClient } from './supabase/server';

export type CornerMaximoPlan = 'FREE' | 'PRO';

export interface CornerMaximoEntitlement {
  plan: CornerMaximoPlan;
  isAuthenticated: boolean;
  isPro: boolean;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
}

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

export async function getCurrentEntitlement(): Promise<CornerMaximoEntitlement> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      plan: 'FREE',
      isAuthenticated: false,
      isPro: false,
      subscriptionStatus: null,
      currentPeriodEnd: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from('billing_subscriptions')
      .select('plan,status,current_period_end')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) {
      return {
        plan: 'FREE',
        isAuthenticated: true,
        isPro: false,
        subscriptionStatus: null,
        currentPeriodEnd: null,
      };
    }

    const periodEnd = typeof data.current_period_end === 'string' ? data.current_period_end : null;
    const periodIsValid = periodEnd == null || new Date(periodEnd).getTime() > Date.now();
    const isPro =
      data.plan === 'PRO' &&
      typeof data.status === 'string' &&
      ACTIVE_STATUSES.has(data.status.toLowerCase()) &&
      periodIsValid;

    return {
      plan: isPro ? 'PRO' : 'FREE',
      isAuthenticated: true,
      isPro,
      subscriptionStatus: typeof data.status === 'string' ? data.status : null,
      currentPeriodEnd: periodEnd,
    };
  } catch {
    // Durante despliegues progresivos la tabla puede tardar en existir.
    // El fallo debe degradar a FREE, nunca abrir contenido PRO por error.
    return {
      plan: 'FREE',
      isAuthenticated: true,
      isPro: false,
      subscriptionStatus: null,
      currentPeriodEnd: null,
    };
  }
}
