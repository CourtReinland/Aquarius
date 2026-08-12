/** Request helpers shared across authenticated / rate-limited routes. */

export function clientIp(c: { req: { header: (name: string) => string | undefined } }) {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return c.req.header('x-real-ip') ?? 'unknown';
}
