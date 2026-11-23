import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryChips } from './CategoryChips';
import type { Category } from '../types/db';

const categories: Category[] = [
  { id: 'c-home', slug: 'home', name: 'Дом', emoji: '🏠', color: '#E4572E', sort_order: 10 },
  { id: 'c-work', slug: 'work', name: 'Работа', emoji: '💼', color: '#2E86AB', sort_order: 20 }
];

describe('CategoryChips', () => {
  it('показывает «Все» и все категории', () => {
    render(<CategoryChips categories={categories} activeId={null} onChange={() => {}} />);

    expect(screen.getByRole('button', { name: 'Все' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Дом/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Работа/ })).toBeTruthy();
  });

  it('сообщает выбранную категорию', async () => {
    const onChange = vi.fn();
    render(<CategoryChips categories={categories} activeId={null} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /Дом/ }));

    expect(onChange).toHaveBeenCalledWith('c-home');
  });

  it('снимает фильтр при повторном нажатии', async () => {
    const onChange = vi.fn();
    render(<CategoryChips categories={categories} activeId="c-home" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /Дом/ }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('помечает активную категорию', () => {
    render(<CategoryChips categories={categories} activeId="c-work" onChange={() => {}} />);

    expect(screen.getByRole('button', { name: /Работа/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Дом/ }).getAttribute('aria-pressed')).toBe('false');
  });
});
