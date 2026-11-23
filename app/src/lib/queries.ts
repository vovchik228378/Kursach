/**
 * Общая выборка метки: сразу с категорией и автором.
 *
 * Связь с profiles указывается явно (`!markers_owner_id_fkey`): между
 * markers и profiles есть и прямая связь (owner_id), и many-to-many через
 * likes, поэтому PostgREST без подсказки отвечает PGRST201.
 */
export const MARKER_SELECT = `
  id, owner_id, category_id, title, description, lat, lng, place_name,
  visibility, created_at,
  categories ( id, slug, name, emoji, color, sort_order ),
  profiles!markers_owner_id_fkey ( username, display_name, avatar_url )
`;
