import { describe, expect, it } from 'vitest';
import { decodeJwtPayload } from './jwt';

function makeToken(payload: Record<string, unknown>): string {
  // btoa есть и в браузере, и в Node 16+; payload в тесте — только ASCII.
  const encode = (value: Record<string, unknown>) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('decodeJwtPayload', () => {
  it('достаёт sub, role и exp', () => {
    const token = makeToken({ sub: 'user-1', role: 'authenticated', exp: 1234567890 });
    expect(decodeJwtPayload(token)).toMatchObject({
      sub: 'user-1',
      role: 'authenticated',
      exp: 1234567890
    });
  });

  it('возвращает null для мусора', () => {
    expect(decodeJwtPayload('')).toBeNull();
    expect(decodeJwtPayload('abc')).toBeNull();
    expect(decodeJwtPayload('a.%%%.c')).toBeNull();
  });
});
