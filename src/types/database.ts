export type RelationshipStatus = 'pending' | 'active' | 'ended';
export type MomentType = 'photo' | 'video' | 'text' | 'voice' | 'mood' | 'location';
export type MoodType =
  | 'happy'
  | 'excited'
  | 'calm'
  | 'stressed'
  | 'lonely'
  | 'loved'
  | 'grateful'
  | 'tired'
  | 'anxious'
  | 'sad'
  | 'angry'
  | 'playful'
  | 'hopeful'
  | 'funny'
  | 'flirty'
  | 'sexy'
  | 'spicy'
  | 'romantic'
  | 'silly'
  | 'heartbroken'
  | 'crying'
  | 'hurt'
  | 'emotional'
  | 'missing';
export type ActivityStatus = 'pending' | 'in_progress' | 'completed';
export type EventType = 'date' | 'anniversary' | 'reminder' | 'experience' | 'custom';
export type JournalType = 'reflection' | 'gratitude' | 'memory' | 'emotion' | 'plan';
export type SubscriptionTier = 'free' | 'plus';

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  subscription_tier?: SubscriptionTier;
  subscription_expires_at?: string | null;
  revenuecat_customer_id?: string | null;
  revenuecat_subscription_id?: string | null;
  location_sharing_enabled?: boolean;
  location_latitude?: number | null;
  location_longitude?: number | null;
  location_label?: string | null;
  location_updated_at?: string | null;
  created_at: string;
}

export interface Relationship {
  id: string;
  user_1_id: string;
  user_2_id: string | null;
  relationship_name: string | null;
  status: RelationshipStatus;
  streak_count: number;
  invite_code: string | null;
  distance_mode: boolean;
  subscription_tier?: SubscriptionTier;
  subscription_owner_id?: string | null;
  anniversary_date?: string | null;
  created_at: string;
}

export interface Moment {
  id: string;
  relationship_id: string;
  user_id: string;
  type: MomentType;
  content: string | null;
  media_url: string | null;
  mood: MoodType | null;
  latitude: number | null;
  longitude: number | null;
  reactions: Record<string, string[]>;
  viewed_by?: string[];
  created_at: string;
  author?: UserProfile;
}

export type SharedAlbumMediaType = 'photo' | 'video';

export interface SharedAlbumItem {
  id: string;
  relationship_id: string;
  user_id: string;
  media_type: SharedAlbumMediaType;
  storage_path: string;
  file_size_bytes: number;
  caption: string | null;
  created_at: string;
  /** Hydrated signed URL for display */
  media_url?: string | null;
  author?: UserProfile;
}

export interface Message {
  id: string;
  relationship_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: 'image' | 'voice' | 'video' | null;
  moment_id: string | null;
  reply_to_id: string | null;
  reactions: Record<string, string[]>;
  is_pinned: boolean;
  deleted_for_all: boolean;
  hidden_for: string[];
  read_at: string | null;
  created_at: string;
  sender?: UserProfile;
  /** Joined when listing messages with moment preview */
  moment?: Pick<Moment, 'id' | 'type' | 'media_url' | 'user_id' | 'created_at'> | null;
}

export interface Activity {
  id: string;
  relationship_id: string;
  type: string;
  payload: Record<string, unknown>;
  status: ActivityStatus;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  relationship_id: string;
  title: string;
  date_time: string;
  type: EventType;
  source: 'manual' | 'activity' | 'experience';
  description: string | null;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  relationship_id: string;
  user_id: string;
  content: string;
  type: JournalType;
  is_private: boolean;
  created_at: string;
  author?: UserProfile;
}

export interface MoodLog {
  id: string;
  relationship_id: string;
  user_id: string;
  mood: MoodType;
  created_at: string;
}

export interface BucketListItem {
  id: string;
  relationship_id: string;
  title: string;
  note: string | null;
  status: 'pending' | 'completed';
  created_at: string;
}

export interface SharedGoal {
  id: string;
  relationship_id: string;
  title: string;
  progress: number;
  status: 'active' | 'completed';
  created_at: string;
}

export interface Experience {
  id: string;
  title: string;
  type: string | null;
  location: string | null;
  price_range: string | null;
  external_url: string | null;
  image_url: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  relationship_id: string;
  user_id: string;
  type: string;
  content: string;
  read: boolean;
  push_dispatched?: boolean;
  created_at: string;
}

export interface Streak {
  id: string;
  relationship_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  user_1_last_active_date?: string | null;
  user_2_last_active_date?: string | null;
  updated_at: string;
}

/** Live streak snapshot from get_streak_status RPC (includes at-risk + partner activity). */
export interface StreakStatus {
  relationship_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  at_risk: boolean;
  both_active_today: boolean;
  user_active_today: boolean;
  partner_active_today: boolean;
  /** True only while streak is 0 and a prior streak was saved — before any new activity. */
  can_restore_streak: boolean;
  restorable_streak: number | null;
  restorable_lost_at: string | null;
}

export interface DailyChallenge {
  id: string;
  relationship_id: string;
  prompt: string;
  type: string;
  user_1_response: string | null;
  user_2_response: string | null;
  completed: boolean;
  challenge_date: string;
  created_at: string;
}

export interface WrappedStats {
  id: string;
  relationship_id: string;
  year: number;
  moments_count: number;
  activities_completed: number;
  mood_summary: Record<string, unknown>;
  highlights: Record<string, unknown>;
  created_at: string;
}

export type WatchSessionStatus = 'scheduled' | 'setup' | 'countdown' | 'watching' | 'ended';
export type WatchPlaybackState = 'playing' | 'paused';
export type WatchContentSource = 'streaming' | 'youtube' | 'video' | 'podcast' | 'music';

export interface WatchReaction {
  user_id: string;
  emoji: string;
  at: string;
}

export interface WatchSession {
  id: string;
  relationship_id: string;
  host_user_id: string;
  title: string;
  link: string | null;
  platform_id: string | null;
  content_source: WatchContentSource;
  content_id: string | null;
  status: WatchSessionStatus;
  ready_user_ids: string[];
  countdown_at: string | null;
  scheduled_at: string | null;
  reminder_minutes: number | null;
  playback_state: WatchPlaybackState;
  playback_position: number;
  playback_updated_at: string | null;
  reactions: WatchReaction[];
  created_at: string;
}

export type QuizLiveSessionStatus = 'lobby' | 'generating' | 'active' | 'finished';
export type QuizLiveRoundPhase = 'answer' | 'reveal';

export interface QuizLiveQuestion {
  question: string;
  type: 'choice' | 'boolean';
  options: string[];
  correctIndex?: number;
}

export interface QuizLiveSession {
  id: string;
  relationship_id: string;
  host_user_id: string;
  topic: string;
  status: QuizLiveSessionStatus;
  round_phase: QuizLiveRoundPhase;
  questions: QuizLiveQuestion[];
  current_index: number;
  responses: Record<string, Record<string, number>>;
  scores: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface WatchMessage {
  id: string;
  session_id: string;
  relationship_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

export interface StreamingConnection {
  id: string;
  user_id: string;
  platform_id: string;
  account_label: string | null;
  connected_at: string;
}

export type WatchVote = 'interested' | 'not' | 'must';

export interface WatchlistItem {
  id: string;
  relationship_id: string;
  added_by: string;
  title: string;
  platform_id: string | null;
  note: string | null;
  votes: Record<string, WatchVote>;
  watched: boolean;
  watched_at: string | null;
  created_at: string;
}

export interface WatchHistoryEntry {
  id: string;
  relationship_id: string;
  logged_by: string | null;
  title: string;
  platform_id: string | null;
  content_id: string | null;
  rating: number | null;
  favorite_moment: string | null;
  prompt_question: string | null;
  prompt_answer: string | null;
  watched_at: string;
}
