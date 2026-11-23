import { useEffect, useRef, useState, type WheelEvent } from 'react';
import type { Category } from '../types/db';

interface CategoryChipsProps {
  categories: Category[];
  activeId: string | null;
  onChange: (id: string | null) => void;
}

const SCROLL_STEP = 220;
const EDGE_TOLERANCE = 4;

/**
 * Горизонтальный список категорий.
 *
 * Категорий восемь плюс «Все», на узком экране они не помещаются,
 * поэтому добавлены стрелки прокрутки и колесо мыши: без них
 * последние категории просто недоступны.
 */
export function CategoryChips({ categories, activeId, onChange }: CategoryChipsProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const update = () => {
      setCanLeft(el.scrollLeft > EDGE_TOLERANCE);
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE_TOLERANCE);
    };

    update();
    el.addEventListener('scroll', update, { passive: true });

    const observer = new ResizeObserver(update);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [categories.length]);

  const scrollByStep = (direction: -1 | 1) => {
    trackRef.current?.scrollBy({ left: direction * SCROLL_STEP, behavior: 'smooth' });
  };

  // Колесо мыши по горизонтальному списку: на десктопе это ожидаемее,
  // чем тянуть полосу прокрутки, которой здесь не видно.
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    el.scrollLeft += event.deltaY;
  };

  return (
    <div className="chips-wrap">
      {canLeft && (
        <button
          type="button"
          className="chips__arrow chips__arrow--left"
          onClick={() => scrollByStep(-1)}
          aria-label="Прокрутить категории назад"
        >
          ‹
        </button>
      )}

      <div
        ref={trackRef}
        className="chips"
        role="group"
        aria-label="Фильтр по категориям"
        onWheel={handleWheel}
      >
        <button
          type="button"
          className={`chip${activeId === null ? ' is-active' : ''}`}
          onClick={() => onChange(null)}
          aria-pressed={activeId === null}
        >
          Все
        </button>

        {categories.map((category) => {
          const active = activeId === category.id;
          return (
            <button
              key={category.id}
              type="button"
              className={`chip${active ? ' is-active' : ''}`}
              onClick={() => onChange(active ? null : category.id)}
              aria-pressed={active}
            >
              <span aria-hidden="true">{category.emoji}</span>
              {category.name}
            </button>
          );
        })}
      </div>

      {canRight && (
        <button
          type="button"
          className="chips__arrow chips__arrow--right"
          onClick={() => scrollByStep(1)}
          aria-label="Прокрутить категории вперёд"
        >
          ›
        </button>
      )}
    </div>
  );
}
