/** Разбор payload JWT без проверки подписи — только для диагностики. */

export interface JwtClaims {
  sub?: string;
  role?: string;
  exp?: number;
  [key: string]: unknown;
}

export function decodeJwtPayload(token: string): JwtClaims | null {
  const part = token.split('.')[1];
  if (!part) return null;

  try {
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const json = atob(padded);
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}
