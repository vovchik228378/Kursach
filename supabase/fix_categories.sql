-- =============================================================================
-- Исправление категорий после «кракозябр»
-- =============================================================================
-- Причина: setup_all.sql был собран в оболочке с кодировкой не UTF-8,
-- поэтому кириллица и эмодзи в сиде превратились в двойную перекодировку.
-- Скрипт идемпотентен: можно запускать повторно.
--
-- Вставить целиком в Supabase Dashboard → SQL Editor → Run.
-- =============================================================================

update public.categories set name = 'Дом',         emoji = '🏠' where slug = 'home';
update public.categories set name = 'Работа',      emoji = '💼' where slug = 'work';
update public.categories set name = 'Еда',         emoji = '🍜' where slug = 'food';
update public.categories set name = 'Природа',     emoji = '🌳' where slug = 'nature';
update public.categories set name = 'Культура',    emoji = '🎭' where slug = 'culture';
update public.categories set name = 'Спорт',       emoji = '🏋️' where slug = 'sport';
update public.categories set name = 'Путешествия', emoji = '✈️' where slug = 'travel';
update public.categories set name = 'Другое',      emoji = '📍' where slug = 'other';

-- Проверка: должно быть 8 строк с нормальным русским текстом.
select slug, emoji, name from public.categories order by sort_order;
