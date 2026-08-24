function withProtocol(value: string): string {
  const trimmed = value.trim().replace(/\/$/, '');
  if (!trimmed) return 'http://localhost:3000';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function getSiteUrl(): string {
  // Vercel exposes the production hostname at build time, so prefer it after project or domain renames.
  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProductionUrl) return withProtocol(vercelProductionUrl);

  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) return withProtocol(configuredUrl);

  return 'http://localhost:3000';
}

export function getBillingReturnUrl(): string {
  const targetEnvironment = process.env.VERCEL_TARGET_ENV ?? process.env.VERCEL_ENV;
  const deploymentUrl = process.env.VERCEL_URL;

  if (targetEnvironment && targetEnvironment !== 'production' && deploymentUrl) {
    return withProtocol(deploymentUrl);
  }

  return getSiteUrl();
}
