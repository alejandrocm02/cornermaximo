const AMBIGUOUS_SSL_MODE = /([?&]sslmode=)(?:prefer|require|verify-ca)(?=&|$)/gi;

/**
 * `pg` currently treats these three modes as `verify-full`, but its next major
 * will adopt weaker libpq semantics. Keep today's verified TLS behaviour
 * explicit without ever logging or otherwise exposing the connection string.
 */
export function normalizeDatabaseUrl(value: string): string {
  return value.replace(AMBIGUOUS_SSL_MODE, '$1verify-full');
}
