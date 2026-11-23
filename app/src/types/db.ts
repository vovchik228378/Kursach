/** Типы строк таблиц. Совпадают с миграциями в supabase/migrations. */

export type Visibility = 'public' | 'friends' | 'private';

export interface Category {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  color: string;
  sort_order: number;
}

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_private: boolean;
  created_at: string;
}

/** Профиль в составе выборки метки (вложенный select). */
export interface MarkerAuthor {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface Marker {
  id: string;
  owner_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  lat: number;
  lng: number;
  place_name: string | null;
  visibility: Visibility;
  created_at: string;
  categories: Category | null;
  profiles: MarkerAuthor | null;
}

export interface NewMarker {
  title: string;
  description: string;
  categoryId: string | null;
  visibility: Visibility;
  lat: number;
  lng: number;
}

/** Профиль без приватных полей — для списков и поиска людей. */
export interface ProfileLite {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface MarkerPhoto {
  id: string;
  marker_id: string;
  owner_id: string;
  storage_path: string;
  created_at: string;
}

export interface MarkerComment {
  id: string;
  marker_id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles: MarkerAuthor | null;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
}
