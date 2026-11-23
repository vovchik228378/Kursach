/**
 * МояКарта — единая инициализация Supabase для всех страниц.
 *
 * Подключается в <head> ПОСЛЕ библиотеки, до остальных скриптов:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js"></script>
 *   <script src="/supabase-client.js"></script>
 *
 * После выполнения файла window.supabase — это уже готовый клиент
 * (результат createClient), как и ожидают скрипты страниц.
 */
(function () {
    'use strict';

    // URL проекта Supabase (публичный, менять не нужно).
    var SUPABASE_URL = 'https://mxdddbkfyugyyzabfqor.supabase.co';

    /**
     * Публичный ключ проекта. Его можно показывать в браузере:
     * доступ к данным ограничивают RLS-политики, а не секретность ключа.
     *
     * Рекомендуется publishable-ключ (начинается с sb_publishable_):
     * Supabase объявил об отказе от anon-ключей к концу 2026 года.
     * Взять его: Dashboard → Settings → API Keys → «Publishable and secret API keys».
     * После вставки ключа сюда старый anon-ключ можно удалить.
     */
    var SUPABASE_PUBLISHABLE_KEY = '';

    /**
     * Устаревший anon-ключ. Работает до отключения legacy-ключей в проекте.
     * Используется только как запасной вариант, пока не задан publishable.
     */
    var SUPABASE_LEGACY_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14ZGRkYmtmeXVneXl6YWJmcW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY3NzMsImV4cCI6MjA2MDY3Mjc3M30.zNoJad5-R0mTP95yz-2_0j-Lj6-eNy4S89ciQ7BZWmQ';

    var apiKey = (SUPABASE_PUBLISHABLE_KEY || SUPABASE_LEGACY_ANON_KEY).trim();

    // secret-ключ (sb_secret_...) обходит RLS и не должен попадать в браузер.
    if (apiKey.indexOf('sb_secret_') === 0) {
        console.error(
            '[Supabase] В клиентский код попал secret-ключ (sb_secret_...). ' +
            'Немедленно отзовите его в Dashboard → Settings → API Keys: он даёт полный доступ к базе.'
        );
        return;
    }

    var library = window.supabase;
    if (!library || typeof library.createClient !== 'function') {
        console.error(
            '[Supabase] Библиотека @supabase/supabase-js не загрузилась. ' +
            'Проверьте подключение CDN-скрипта перед этим файлом и доступность cdn.jsdelivr.net.'
        );
        return;
    }

    if (apiKey.indexOf('sb_publishable_') !== 0) {
        console.warn(
            '[Supabase] Используется устаревший anon-ключ. ' +
            'Создайте publishable-ключ и укажите его в public/supabase-client.js ' +
            '(поддержка legacy-ключей прекращается в конце 2026 года).'
        );
    }

    window.supabase = library.createClient(SUPABASE_URL, apiKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        },
        db: {
            schema: 'public'
        }
    });
})();
