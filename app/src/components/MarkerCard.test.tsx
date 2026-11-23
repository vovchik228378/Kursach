import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarkerCard } from './MarkerCard';
import type { Marker } from '../types/db';

const marker: Marker = {
  id: 'm1',
  owner_id: 'u1',
  category_id: 'c-home',
  title: 'Кофейня на Тверской',
  description: 'Лучший флэт уайт',
  lat: 55.76,
  lng: 37.6,
  place_name: 'Тверская, 1',
  visibility: 'public',
  created_at: '2026-01-01T00:00:00Z',
  categories: {
    id: 'c-home',
    slug: 'home',
    name: 'Дом',
    emoji: '🏠',
    color: '#E4572E',
    sort_order: 10
  },
  profiles: { username: 'vova', display_name: 'Вова', avatar_url: null }
};

describe('MarkerCard', () => {
  it('показывает название, автора и место', () => {
    render(<MarkerCard marker={marker} active={false} onClick={() => {}} />);

    expect(screen.getByText('Кофейня на Тверской')).toBeTruthy();
    expect(screen.getByText(/Вова/)).toBeTruthy();
    expect(screen.getByText(/Тверская, 1/)).toBeTruthy();
    expect(screen.getByText('Лучший флэт уайт')).toBeTruthy();
  });

  it('вызывает обработчик при клике', async () => {
    const onClick = vi.fn();
    render(<MarkerCard marker={marker} active={false} onClick={onClick} />);

    await userEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('помечает активное состояние', () => {
    const { container } = render(<MarkerCard marker={marker} active onClick={() => {}} />);

    const card = container.querySelector('.marker-card');
    expect(card?.className).toContain('is-active');
    expect(card?.getAttribute('aria-pressed')).toBe('true');
  });

  it('не падает без категории и автора', () => {
    const bare: Marker = { ...marker, categories: null, profiles: null };
    render(<MarkerCard marker={bare} active={false} onClick={() => {}} />);

    expect(screen.getByText('Кофейня на Тверской')).toBeTruthy();
    expect(screen.getByText(/Неизвестный автор/)).toBeTruthy();
  });
});
