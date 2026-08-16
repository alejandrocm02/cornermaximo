function withProtocol(value: string): string {
  const trimmed = value.trim().replace(/\/$/, '');
  if (!trimmed) return 'http://localhost:3000';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function getSiteUrl(): string {
  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProductionUrl) return withProtocol(vercelProductionUrl);

  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) return withProtocol(configuredUrl);

  return 'http://localhost:3000';
}
