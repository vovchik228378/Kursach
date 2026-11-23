import { describe, expect, it } from 'vitest';
import { MARKER_SELECT } from './queries';

describe('MARKER_SELECT', () => {
  it('уточняет связь с profiles по имени внешнего ключа', () => {
    // Между markers и profiles есть и owner_id, и many-to-many через likes.
    // Без подсказки PostgREST отвечает PGRST201 «more than one relationship».
    expect(MARKER_SELECT).toContain('profiles!markers_owner_id_fkey');
  });

  it('не содержит неоднозначного встраивания profiles(...)', () => {
    expect(MARKER_SELECT).not.toMatch(/profiles\s*\(/);
  });
});
