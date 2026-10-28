// Shared-secret check for webhooks. Refuses everything when the secret is not configured (never compares
// against undefined), and compares in constant time.
export function secretMatches(provided: string | null, expected: string | undefined | null): boolean {
  if (!expected || !provided) return false;
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
