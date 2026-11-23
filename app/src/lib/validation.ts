/** Валидация и перевод ошибок — то, что удобно проверять юнит-тестами. */

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value.trim());
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/**
 * Supabase отвечает по-английски и довольно технично. Показываем пользователю
 * понятный текст, а необработанные случаи отдаём как есть.
 */
export function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'Неверный email или пароль.';
  }
  if (message.includes('Email not confirmed')) {
    return 'Почта не подтверждена. Проверьте письмо — возможно, оно в папке «Спам».';
  }
  if (message.toLowerCase().includes('rate limit')) {
    return 'Слишком много попыток входа. Подождите пару минут.';
  }
  if (message.includes('already registered')) {
    return 'Пользователь с такой почтой уже зарегистрирован.';
  }
  if (message.includes('duplicate key')) {
    return 'Этот ник уже занят — придумайте другой.';
  }
  return message;
}

/**
 * Supabase возвращает ошибку подтверждения почты или сброса пароля
 * в hash редиректа: #error=access_denied&error_code=otp_expired&...
 * Без разбора пользователь видит пустую страницу и не понимает, что делать.
 */
export function parseAuthError(hash: string): string | null {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  if (!params.get('error')) return null;

  const description = params.get('error_description');
  if (description) {
    const text = description.replace(/\+/g, ' ');
    if (/invalid or has expired/i.test(text)) {
      return 'Ссылка недействительна или срок её действия истёк. Запросите новую.';
    }
    return text;
  }

  return 'Ссылка недействительна или устарела. Запросите новую.';
}

export function readAuthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return parseAuthError(window.location.hash);
}
