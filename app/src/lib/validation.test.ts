import { describe, expect, it } from 'vitest';
import { isValidEmail, isValidUsername, parseAuthError, translateAuthError } from './validation';

describe('isValidUsername', () => {
  it('принимает латиницу, цифры и подчёркивание', () => {
    expect(isValidUsername('vova_map')).toBe(true);
    expect(isValidUsername('user123')).toBe(true);
    expect(isValidUsername('ABC')).toBe(true);
  });

  it('отклоняет короткие, длинные и недопустимые ники', () => {
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a'.repeat(31))).toBe(false);
    expect(isValidUsername('вова')).toBe(false);
    expect(isValidUsername('vova-map')).toBe(false);
    expect(isValidUsername('vova map')).toBe(false);
  });

  it('игнорирует пробелы по краям', () => {
    expect(isValidUsername('  vova  ')).toBe(true);
  });
});

describe('isValidEmail', () => {
  it('принимает обычные адреса', () => {
    expect(isValidEmail('vova@example.com')).toBe(true);
    expect(isValidEmail('  user.name+tag@mail.ru  ')).toBe(true);
  });

  it('отклоняет адреса без домена, собаки или с пробелом', () => {
    expect(isValidEmail('vova')).toBe(false);
    expect(isValidEmail('vova@')).toBe(false);
    expect(isValidEmail('vova@example')).toBe(false);
    expect(isValidEmail('vo va@example.com')).toBe(false);
  });
});

describe('translateAuthError', () => {
  it('переводит типовые ошибки Supabase', () => {
    expect(translateAuthError('Invalid login credentials')).toBe('Неверный email или пароль.');
    expect(translateAuthError('Email not confirmed')).toContain('Почта не подтверждена');
    expect(translateAuthError('email rate limit exceeded')).toContain('Слишком много попыток');
    expect(translateAuthError('User already registered')).toContain('уже зарегистрирован');
    expect(translateAuthError('duplicate key value violates unique constraint')).toContain(
      'ник уже занят'
    );
  });

  it('оставляет незнакомый текст без изменений', () => {
    expect(translateAuthError('Network error')).toBe('Network error');
  });
});

describe('parseAuthError', () => {
  it('достаёт причину из hash редиректа', () => {
    expect(
      parseAuthError(
        '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
      )
    ).toBe('Ссылка недействительна или срок её действия истёк. Запросите новую.');
  });

  it('не считает ошибкой успешный редирект с токеном', () => {
    expect(parseAuthError('#access_token=abc&type=recovery')).toBeNull();
    expect(parseAuthError('')).toBeNull();
  });

  it('показывает нестандартное описание как есть', () => {
    expect(parseAuthError('#error=x&error_description=Something+wrong')).toBe('Something wrong');
  });
});
