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
export type SubscriptionTier = 'free' | 'plus';
export type ProfileGender =
  | 'male'
  | 'female'
  | 'non_binary'
  | 'genderqueer'
  | 'genderfluid'
  | 'agender'
  | 'other'
  | 'prefer_not_to_say';
export type RelationshipType = 'dating' | 'long_distance' | 'engaged' | 'married' | 'other';

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  gender?: ProfileGender | null;
  /** How you identify (the newer column, with every option; see lib/profile-gender). */
  gender_identity?: ProfileGender | null;
  /** YYYY-MM-DD, optional. Your partner sees it (countdown and reminders). */
  birthday?: string | null;
  subscription_tier?: SubscriptionTier;
  subscription_expires_at?: string | null;
  /** Superwall user id (UUID derived from the Clerk id). Server-written. */
  billing_user_id?: string | null;
  /** The store's original transaction id for the subscription. Server-written. */
  billing_subscription_id?: string | null;
  billing_product_id?: string | null;
  /** Reciprocal: when false, you also cannot see your partner's shared location. */
  location_sharing_enabled?: boolean;
  location_latitude?: number | null;
  location_longitude?: number | null;
  location_label?: string | null;
  location_updated_at?: string | null;
  /** When false, neither partner sees online / last-active for this user. Default true. */
  show_online_status?: boolean;
  /** Last time this user was actively online. */
  last_seen_at?: string | null;
  /** IANA timezone identifier (e.g. "Europe/Lisbon"), synced from the device locale. */
  timezone?: string | null;
  /** Settings > Notifications switches; missing keys mean on. */
  notification_prefs?: Record<string, boolean> | null;
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
  /** When the couple's Plus (or its free trial) ends. Written by the Superwall webhook. */
  subscription_expires_at?: string | null;
  /** 'trial' during the free trial, 'normal' once paying. */
  /** 'grace': a renewal failed and the store is retrying; Plus stays on meanwhile. */
  subscription_period?: 'trial' | 'normal' | 'grace' | null;
  subscription_product?: string | null;
  /** Free Plus from referrals, until this time. Written by the server only. */
  bonus_plus_until?: string | null;
  /** Developer "Pretend Plus is on" (server side too). */
  dev_plus?: number | boolean | null;
  anniversary_date?: string | null;
  relationship_type?: RelationshipType | null;
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
  /** Set when the sender edited the text (shows "Edited"). */
  edited_at?: string | null;
  /** When it was pinned (orders the pinned bar). */
  pinned_at?: string | null;
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
  /** Optional preview image (moment alerts). */
  media_url?: string | null;
  /** Optional linked entity id (e.g. moment id). */
  related_id?: string | null;
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
/**
 * Streaks are individual (like Paired): each of you keeps your own with a daily check-in
 * (a moment, a mood, answering today's question, or playing). `current_streak`, `longest_streak`,
 * `at_risk`, the restore fields and `active_days` are YOURS — what every screen shows.
 * Your partner's streak and the together streak (days you both showed up) come alongside.
 */
export interface StreakStatus {
  relationship_id: string;
  /** Your streak. */
  current_streak: number;
  longest_streak: number;
  /** The last day you checked in (YYYY-MM-DD). */
  last_active_date: string | null;
  /** Your streak ends tonight: you checked in yesterday, not yet today. */
  at_risk: boolean;
  /** You both checked in today. */
  both_active_today: boolean;
  user_active_today: boolean;
  partner_active_today: boolean;
  /** True only while your streak is 0 and the one you lost can still be brought back. */
  can_restore_streak: boolean;
  restorable_streak: number | null;
  /** ISO timestamp when your streak was lost; restore is valid for 24 hours after this. */
  restorable_lost_at: string | null;
  /** Days (YYYY-MM-DD) you checked in. */
  active_days?: string[];
  /** Streak freezes you hold (0–2): one is used automatically on a missed day. */
  streak_freezes?: number;
  /** Days (YYYY-MM-DD) a freeze covered: the streak carried on, drawn frozen. */
  frozen_days?: string[];
  /** Older servers: days with any couple activity. */
  activity_days?: string[];
  /** Your partner's streak. */
  partner_streak?: number;
  partner_longest_streak?: number;
  /** Your partner's streak ends tonight. */
  partner_at_risk?: boolean;
  /** Days in a row you BOTH checked in. */
  together_streak?: number;
  together_longest_streak?: number;
  /** Days (YYYY-MM-DD) you both checked in. */
  together_days?: string[];
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


