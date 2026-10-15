import {
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Contacts from 'expo-contacts';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from '@/lib/haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type GestureResponderEvent,
} from 'react-native';
import { TextInput } from '@/components/ui/ThemedTextInput';
import { FlatList } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatAttachmentSheet } from '@/components/chat/ChatAttachmentSheet';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { ChatCameraModal } from '@/components/chat/ChatCameraModal';
import { ChatEmojiPicker } from '@/components/chat/ChatEmojiPicker';
import { ChatEmptyProfile } from '@/components/chat/ChatEmptyProfile';
import { ChatDateSeparator, ChatUnreadDivider } from '@/components/chat/ChatListSeparators';
import { ChatMessageActionSheet } from '@/components/chat/ChatMessageActionSheet';
import { ChatReplyBar } from '@/components/chat/ChatReplyBar';
import { ChatVoiceRecorder } from '@/components/chat/ChatVoiceRecorder';
import { ChatWallpaper } from '@/components/chat/ChatWallpaper';
import { PartnerStatusLine } from '@/components/chat/PartnerStatusLine';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { LoadingState } from '@/components/home/MoodSnapshot';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { FullScreenImageModal } from '@/components/ui/FullScreenImageModal';
import { useInfiniteMessages, useMessageActions, useSendMessage } from '@/hooks/queries';
import { useChatUnreadBanner } from '@/hooks/useChatUnreadBanner';
import { useOpenPartnerProfile } from '@/hooks/useOpenPartnerProfile';
import { usePartnerPresence } from '@/hooks/usePartnerPresence';
import { useStartCall } from '@/hooks/useStartCall';
import { useTheme } from '@/hooks/useTheme';
import { encodeAttachment } from '@/lib/chat-attachments';
import { getCachedChatDraft, loadStoredChatDraft, saveChatDraft } from '@/lib/chat-draft';
import { buildChatListItems, type ChatListItem } from '@/lib/chat-list';
import { messagePreviewLabel } from '@/lib/chat-media';
import { flushChatOfflineQueue } from '@/lib/chat-offline-flush';
import type { ChatOfflinePayload } from '@/lib/chat-offline-queue';
import { getCurrentPlace } from '@/lib/location';
import { closeStackScreen } from '@/lib/router';
import { backend } from '@/lib/backend';
import * as api from '@/services/api';
import { useAuthStore, useOfflineStore, useRelationshipStore, useUIStore } from '@/stores';
import type { Message } from '@/types/database';
import { ensurePermission } from '@/lib/permissions';

/** Voice notes: high quality with live levels for the recording waveform. */
const VOICE_PRESET = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
/** Shorter than this is a tap (hands-free); longer is a hold (release sends). */
const MIC_HOLD_MS = 350;
/** A hold shorter than this is treated as a slip and discarded. */
const MIN_HOLD_RECORD_MS = 1000;
/** Like WhatsApp: a few pins keep the bar useful. */
const MAX_PINNED = 3;

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const user = useAuthStore((s) => s.user);
  const isOffline = useUIStore((s) => s.isOffline);
  const chatDraft = useUIStore((s) => s.chatDraft);
  const chatMomentReply = useUIStore((s) => s.chatMomentReply);
  const clearChatDraft = useUIStore((s) => s.clearChatDraft);
  const setChatMomentReply = useUIStore((s) => s.setChatMomentReply);
  const openPartnerProfileView = useOpenPartnerProfile();
  const [showPartnerPhoto, setShowPartnerPhoto] = useState(false);
  const offlineQueue = useOfflineStore((s) => s.queue);
  const addToQueue = useOfflineStore((s) => s.addToQueue);
  const removeFromQueue = useOfflineStore((s) => s.removeFromQueue);
  const hydrateOfflineQueue = useOfflineStore((s) => s.hydrateQueue);

  // Text — starts from any unsent draft left the last time Chat was open.
  const [text, setText] = useState(() => getCachedChatDraft(relationship?.id)?.text ?? '');
  // UI
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(() => getCachedChatDraft(relationship?.id)?.replyTo ?? null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachment, setShowAttachment] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  // Recording
  const audioRecorder = useAudioRecorder(VOICE_PRESET);
  const recorderState = useAudioRecorderState(audioRecorder, 90);
  const [isRecording, setIsRecording] = useState(false);
  /** True while the mic is held down (walkie-talkie): letting go sends. */
  const [holdingMic, setHoldingMic] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const isRecordingRef = useRef(false);
  const micPressedAt = useRef(0);
  const recordingStart = useRef<Promise<boolean> | null>(null);
  const [isSendingMedia, setIsSendingMedia] = useState(false);
  const [flushingOffline, setFlushingOffline] = useState(false);
  const [pendingScrollMessageId, setPendingScrollMessageId] = useState<string | null>(null);
  // The message just jumped to, flashed once it's on screen.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // Mirrors for the unmount cleanup below (state is stale there).
  const panelRef = useRef({ emoji: false, keyboard: false });
  useEffect(() => {
    panelRef.current = { emoji: showEmoji, keyboard: keyboardVisible };
  }, [showEmoji, keyboardVisible]);

  const listRef = useRef<FlatList>(null);
  const typingChannel = useRef<ReturnType<typeof backend.channel> | null>(null);
  const typingChannelReady = useRef(false);
  const lastTypingSent = useRef(0);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const loadingOlderRef = useRef(false);
  const nearBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);

  const { messages, isFetching, isPending, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useInfiniteMessages();
  const { unreadBannerIds, unreadBannerCount, onComposerActivity, onViewableItemsChanged, viewabilityConfig } =
    useChatUnreadBanner(messages);
  const {
    isOnline: partnerOnline,
    lastSeenAt: partnerLastSeenAt,
    statusHidden: partnerStatusHidden,
  } = usePartnerPresence(relationship?.id, user?.id, partner?.id);
  const sendMessage = useSendMessage();
  const { react, pin, deleteForMe, deleteForAll, edit: editMessage } = useMessageActions();
  // Your own text message being edited from the long-press menu (the box holds its text).
  const [editing, setEditing] = useState<Message | null>(null);

  useEffect(() => {
    if (!relationship?.id || !user?.id || partner?.id) return;
    const partnerId = relationship.user_1_id === user.id ? relationship.user_2_id : relationship.user_1_id;
    if (!partnerId) return;

    let cancelled = false;
    void api.fetchPartnerProfile(partnerId).then((profile) => {
      if (!cancelled && profile) {
        useRelationshipStore.getState().setPartner(profile);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [relationship?.id, relationship?.user_1_id, relationship?.user_2_id, user?.id, partner?.id]);

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  // Opening the thread should land you where you left off (the first unread message), not
  // jump straight past unread history to the very bottom — same as WhatsApp/iMessage, and
  // consistent with the unread divider only marking things read once actually scrolled by.
  const scrollToLatestOrUnread = useCallback(
    (animated = true) => {
      if (unreadBannerIds && unreadBannerIds.size > 0) {
        setPendingScrollMessageId('unread-divider');
        return;
      }
      scrollToLatest(animated);
    },
    [unreadBannerIds, scrollToLatest],
  );

  const scrollToLatestIfNearBottom = useCallback(
    (animated = true) => {
      if (!initialScrollDoneRef.current) {
        scrollToLatestOrUnread(animated);
        initialScrollDoneRef.current = true;
        return;
      }
      if (nearBottomRef.current) {
        scrollToLatest(animated);
      }
    },
    [scrollToLatest, scrollToLatestOrUnread],
  );

  // Belt-and-suspenders initial scroll: FlatList's onLayout/onContentSizeChange can fire
  // before item heights are fully settled (especially for a long first page of messages),
  // so also force a scroll-to-bottom (or scroll-to-unread) once the first page lands.
  useEffect(() => {
    if (initialScrollDoneRef.current || messages.length === 0) return;
    const t = setTimeout(() => {
      scrollToLatestOrUnread(false);
      initialScrollDoneRef.current = true;
    }, 60);
    return () => clearTimeout(t);
  }, [messages.length, unreadBannerIds, scrollToLatestOrUnread]);

  // Chat is a stack screen that remounts on every open, but it can also regain focus without
  // remounting (e.g. returning from a screen pushed on top of it) — re-land on the latest or
  // first-unread message then too, rather than wherever the list happened to be scrolled.
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => {
        scrollToLatestOrUnread(false);
      }, 60);
      return () => clearTimeout(t);
    }, [scrollToLatestOrUnread]),
  );

  // Lift composer above the keyboard + autocorrect suggestion bar.
  // screenY is the top of that whole chrome, so the suggestion strip is included.
  useEffect(() => {
    const applyKeyboardFrame = (e: { endCoordinates: { height: number; screenY: number } }) => {
      const { height, screenY } = e.endCoordinates;
      if (height <= 0) {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
        return;
      }

      const lift = Math.max(0, Dimensions.get('window').height - screenY);
      setKeyboardVisible(true);
      setKeyboardHeight(lift);
      scrollToLatest(true);
    };

    const onHide = () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      applyKeyboardFrame,
    );
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', onHide);
    const changeSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidChangeFrame',
      applyKeyboardFrame,
    );
    return () => {
      showSub.remove();
      hideSub.remove();
      changeSub.remove();
    };
  }, [scrollToLatest]);

  // Leaving Chat folds the keyboard / emoji panel away; it comes back closed next time,
  // with whatever was typed (emoji included) still in the box (see the draft effects below).
  useEffect(() => {
    return () => {
      Keyboard.dismiss();
    };
  }, []);

  /** A tap (not a scroll) anywhere in the messages or header puts the keyboard / emoji panel away. */
  const tapStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const closeOnTap = {
    onTouchStart: (e: GestureResponderEvent) => {
      tapStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, t: Date.now() };
    },
    onTouchEnd: (e: GestureResponderEvent) => {
      const s = tapStart.current;
      tapStart.current = null;
      if (!s || Date.now() - s.t > 500) return;
      if (Math.abs(e.nativeEvent.pageX - s.x) > 10 || Math.abs(e.nativeEvent.pageY - s.y) > 10) return;
      if (!panelRef.current.emoji && !panelRef.current.keyboard) return;
      inputRef.current?.blur();
      Keyboard.dismiss();
      setShowEmoji(false);
    },
  };

  // After an app restart the memory copy is gone: bring the draft back from storage.
  useEffect(() => {
    const relationshipId = relationship?.id;
    if (!relationshipId || getCachedChatDraft(relationshipId)) return;
    let cancelled = false;
    void loadStoredChatDraft(relationshipId).then((stored) => {
      if (!cancelled && stored) setText((current) => current || stored);
    });
    return () => {
      cancelled = true;
    };
  }, [relationship?.id]);

  // Keep the draft (and the message being replied to) as it's typed, so
  // leaving Chat and coming back finds it where you left it. Sending clears it.
  useEffect(() => {
    // An edit in progress isn't a draft: it belongs to the message being edited.
    if (!relationship?.id || editing) return;
    saveChatDraft(relationship.id, { text, replyTo });
  }, [relationship?.id, text, replyTo, editing]);

  useEffect(() => {
    if (!chatDraft && !chatMomentReply) return;
    if (chatDraft) setText(chatDraft);
    clearChatDraft();
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [chatDraft, chatMomentReply, clearChatDraft]);

  useEffect(() => {
    if (!relationship?.id) return;
    void hydrateOfflineQueue(relationship.id);
  }, [relationship?.id, hydrateOfflineQueue]);

  // Typing broadcast
  useEffect(() => {
    if (!relationship?.id || !user?.id) return;
    const ch = backend.channel(`typing:${relationship.id}`, {
      config: { broadcast: { self: false } },
    });
    ch.on('broadcast', { event: 'typing' }, (payload) => {
      if (payload.payload?.userId && payload.payload.userId !== user.id) {
        setPartnerTyping(true);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setPartnerTyping(false), 2500);
      }
    }).subscribe((status) => {
      typingChannelReady.current = status === 'SUBSCRIBED';
    });
    typingChannel.current = ch;
    return () => {
      typingChannelReady.current = false;
      backend.removeChannel(ch);
      typingChannel.current = null;
    };
  }, [relationship?.id, user?.id]);

  // Flush durable offline queue sequentially when back online. A failed flush
  // backs off before retrying — otherwise a message the server keeps rejecting
  // would be re-sent in a tight loop the instant the previous attempt ended.
  const flushPausedRef = useRef(false);
  const [flushRetryTick, setFlushRetryTick] = useState(0);
  useEffect(() => {
    if (isOffline || offlineQueue.length === 0 || !relationship || !user || flushingOffline) return;
    if (flushPausedRef.current) return;

    const pending = offlineQueue.filter((item) => item.type === 'message');
    if (pending.length === 0) return;

    setFlushingOffline(true);
    void flushChatOfflineQueue({
      relationshipId: relationship.id,
      userId: user.id,
      items: pending,
      partnerUserId: partner?.id,
      senderName: user.name,
      onSent: removeFromQueue,
    })
      .then(async ({ failed }) => {
        await refetch();
        if (failed > 0) {
          flushPausedRef.current = true;
          setTimeout(() => {
            flushPausedRef.current = false;
            setFlushRetryTick((n) => n + 1);
          }, 15_000);
        }
      })
      .finally(() => setFlushingOffline(false));
  }, [
    isOffline,
    offlineQueue,
    relationship,
    user,
    partner?.id,
    flushingOffline,
    removeFromQueue,
    refetch,
    flushRetryTick,
  ]);

  // Unsent messages render straight from the durable offline queue, so they
  // survive an app restart and disappear the moment they actually send (the
  // real message then arrives via the realtime refetch) — never a temp bubble
  // left behind next to its delivered twin.
  const queuedMessages = useMemo<Message[]>(() => {
    if (!user || !relationship) return [];
    return offlineQueue
      .filter((item) => item.type === 'message')
      .map((item) => ({
        id: item.id,
        relationship_id: relationship.id,
        sender_id: user.id,
        content: item.payload.content,
        media_url: item.payload.mediaLocalUri ?? item.payload.mediaUrl ?? null,
        media_type: (item.payload.mediaType as Message['media_type']) ?? null,
        moment_id: item.payload.momentId ?? null,
        reply_to_id: item.payload.replyToId ?? null,
        reactions: {},
        is_pinned: false,
        deleted_for_all: false,
        hidden_for: [],
        read_at: null,
        created_at: item.createdAt,
      }));
  }, [offlineQueue, user, relationship]);

  const allMessages = useMemo(() => {
    // Our own message can come back over realtime before the send call returns; once the
    // real one is in, drop its temporary "sending" copy so it never shows twice.
    const landed = (temp: Message) =>
      messages.some(
        (m) =>
          m.sender_id === temp.sender_id &&
          (m.content ?? '') === (temp.content ?? '') &&
          (m.media_url ?? null) === (temp.media_url ?? null) &&
          new Date(m.created_at).getTime() >= new Date(temp.created_at).getTime() - 10_000,
      );
    const pending = [...queuedMessages, ...optimisticMessages.filter((m) => !landed(m))].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    return [...messages, ...pending];
  }, [messages, queuedMessages, optimisticMessages]);
  const messageById = useMemo(() => new Map(allMessages.map((message) => [message.id, message])), [allMessages]);
  // Pinned messages, newest pin first. The bar shows one at a time; tapping it jumps
  // there and moves on to the next (WhatsApp / Telegram).
  const pinned = useMemo(
    () =>
      messages
        .filter((m) => m.is_pinned && !m.deleted_for_all)
        .sort((a, b) => (b.pinned_at ?? b.created_at).localeCompare(a.pinned_at ?? a.created_at)),
    [messages],
  );
  const [pinCursor, setPinCursor] = useState(0);
  const shownPin = pinned.length ? pinned[pinCursor % pinned.length] : null;
  const shownPinIndex = pinned.length ? pinCursor % pinned.length : 0;

  const togglePin = (messageId: string, isPinned: boolean) => {
    if (!isPinned || pinned.some((m) => m.id === messageId)) {
      pin.mutate({ messageId, isPinned });
      return;
    }
    if (pinned.length < MAX_PINNED) {
      pin.mutate({ messageId, isPinned: true });
      setPinCursor(0);
      return;
    }
    const oldest = pinned[pinned.length - 1];
    Alert.alert(
      `You can pin up to ${MAX_PINNED} messages`,
      'Replace the oldest pinned message with this one?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          onPress: () => {
            pin.mutate({ messageId: oldest.id, isPinned: false });
            pin.mutate({ messageId, isPinned: true });
            setPinCursor(0);
          },
        },
      ],
    );
  };
  const listItems = useMemo(() => {
    if (!user) return [];
    const bannerIds = unreadBannerIds && unreadBannerIds.size > 0 ? unreadBannerIds : new Set<string>();
    return buildChatListItems(allMessages, user.id, bannerIds);
  }, [allMessages, user, unreadBannerIds]);

  // ─── Text send ───────────────────────────────────────────────────────────
  const onChangeText = (t: string) => {
    setText(t);
    if (t.length > 0) onComposerActivity();
    if (!user?.id || !typingChannelReady.current) return;

    const now = Date.now();
    if (now - lastTypingSent.current < 400) return;
    lastTypingSent.current = now;

    typingChannel.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id },
    });
  };

  /** A local, not-yet-confirmed message (shown with a pending clock, not a sent tick). */
  const sendLockRef = useRef(false);

  const pendingMessage = (id: string, fields: Partial<Message>): Message => ({
    id,
    relationship_id: relationship?.id ?? '',
    sender_id: user?.id ?? '',
    content: '',
    media_url: null,
    media_type: null,
    moment_id: null,
    reply_to_id: null,
    reactions: {},
    is_pinned: false,
    deleted_for_all: false,
    hidden_for: [],
    read_at: null,
    created_at: new Date().toISOString(),
    ...fields,
  });

  /** A send failed: hand it to the durable queue under the same id, so the bubble stays put. */
  const moveToQueue = (id: string, payload: ChatOfflinePayload) => {
    setOptimisticMessages((prev) => prev.filter((m) => m.id !== id));
    if (relationship) addToQueue({ id, type: 'message', payload }, relationship.id);
  };

  const handleSend = useCallback(async () => {
    if (!text.trim() || !user || !relationship) return;
    // A fast double-tap fires twice before the cleared box re-renders: send once.
    if (sendLockRef.current) return;
    sendLockRef.current = true;
    setTimeout(() => {
      sendLockRef.current = false;
    }, 500);
    const content = text.trim();
    if (editing) {
      const target = editing;
      setEditing(null);
      setText('');
      if (content !== target.content?.trim()) editMessage.mutate({ messageId: target.id, content });
      return;
    }
    const momentPayload: {
      momentId?: string;
      mediaUrl?: string;
      mediaType?: 'image' | 'video';
    } = chatMomentReply
      ? {
          momentId: chatMomentReply.momentId,
          mediaUrl: chatMomentReply.mediaUrl ?? undefined,
          mediaType: chatMomentReply.momentType === 'video' ? 'video' : 'image',
        }
      : {};
    const replyToId = replyTo?.id.startsWith('temp-') ? undefined : replyTo?.id;
    setText('');
    setShowEmoji(false);
    setChatMomentReply(null);
    setReplyTo(null);
    nearBottomRef.current = true;

    const id = `temp-${Date.now()}`;
    const payload = { content, ...momentPayload, replyToId };

    // Offline: straight into the durable queue (which renders its own pending bubble).
    if (isOffline) {
      addToQueue({ id, type: 'message', payload }, relationship.id);
      return;
    }

    setOptimisticMessages((prev) => [
      ...prev,
      pendingMessage(id, {
        content,
        media_url: momentPayload.mediaUrl ?? null,
        media_type: momentPayload.mediaType ?? null,
        moment_id: momentPayload.momentId ?? null,
        reply_to_id: replyToId ?? null,
      }),
    ]);
    try {
      await sendMessage.mutateAsync(payload);
    } catch {
      moveToQueue(id, payload);
      return;
    }
    setOptimisticMessages((prev) => prev.filter((m) => m.id !== id));
    // Analytics only — kept out of the try above so a tracking failure can never
    // re-queue (and so double-send) a message that already went through.
    void api.trackEvent(relationship.id, user.id, 'message_sent').catch(() => undefined);
    // pendingMessage/moveToQueue are recreated each render but only read stable state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, user, relationship, chatMomentReply, replyTo, isOffline, sendMessage, addToQueue, setChatMomentReply, editing, editMessage]);

  const startEdit = (message: Message) => {
    setReplyTo(null);
    setEditing(message);
    setText(message.content ?? '');
    setTimeout(() => inputRef.current?.focus(), 250);
  };

  const cancelEdit = () => {
    setEditing(null);
    setText(getCachedChatDraft(relationship?.id)?.text ?? '');
  };

  // ─── Emoji insert ─────────────────────────────────────────────────────────
  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  /** ⌫ on the emoji keyboard: drop the last character (a whole emoji, not half of one). */
  const handleEmojiBackspace = () => {
    setText((prev) => Array.from(prev).slice(0, -1).join(''));
  };

  const toggleEmoji = () => {
    if (!showEmoji) {
      inputRef.current?.blur();
      setShowAttachment(false);
    }
    setShowEmoji((v) => !v);
  };

  // ─── Image / Camera ───────────────────────────────────────────────────────
  /**
   * Shared by photos, videos and voice notes: the bubble appears instantly from
   * the on-device file (no blank wait while it uploads), then upload + send;
   * on failure it moves into the offline queue under the same id, keeping the
   * local file so the queue can retry the upload later.
   */
  const sendLocalMedia = async (uri: string, mediaType: 'image' | 'video' | 'voice', content = '') => {
    if (!user || !relationship) return;
    const id = `temp-${Date.now()}`;
    const queuePayload: ChatOfflinePayload = { content, mediaLocalUri: uri, mediaType };
    nearBottomRef.current = true;

    if (isOffline) {
      addToQueue({ id, type: 'message', payload: queuePayload }, relationship.id);
      return;
    }

    setOptimisticMessages((prev) => [...prev, pendingMessage(id, { content, media_url: uri, media_type: mediaType })]);
    setIsSendingMedia(true);
    try {
      const ext = mediaType === 'voice' ? 'm4a' : mediaType === 'video' ? 'mp4' : (uri.split('.').pop() ?? 'jpg');
      const contentType = mediaType === 'voice' ? 'audio/mp4' : mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
      const path = `${relationship.id}/${user.id}-${mediaType}-${Date.now()}.${ext}`;
      const mediaUrl = await api.uploadChatMedia(path, uri, contentType);
      await sendMessage.mutateAsync({ content, mediaUrl, mediaType });
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== id));
    } catch {
      moveToQueue(id, queuePayload);
    } finally {
      setIsSendingMedia(false);
    }
  };

  const sendImageMessage = (uri: string, mediaType: 'image' | 'video') => sendLocalMedia(uri, mediaType);

  const handlePickGallery = async () => {
    if (!(await ensurePermission('photos'))) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      allowsEditing: false,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const type = asset.type === 'video' ? 'video' : 'image';
      await sendImageMessage(asset.uri, type);
    }
  };

  const openCamera = () => setShowCamera(true);

  const handleCameraCapture = async (uri: string, mediaType: 'image' | 'video') => {
    setShowCamera(false);
    await sendImageMessage(uri, mediaType);
  };

  const sendAttachmentMessage = async (content: string) => {
    if (!user || !relationship) return;
    const replyToId = replyTo?.id.startsWith('temp-') ? undefined : replyTo?.id;
    const id = `temp-${Date.now()}`;
    const payload: ChatOfflinePayload = { content, replyToId };
    setReplyTo(null);
    nearBottomRef.current = true;

    if (isOffline) {
      addToQueue({ id, type: 'message', payload }, relationship.id);
      return;
    }

    setOptimisticMessages((prev) => [...prev, pendingMessage(id, { content, reply_to_id: replyToId ?? null })]);
    try {
      await sendMessage.mutateAsync({ content, replyToId });
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== id));
    } catch {
      moveToQueue(id, payload);
    }
  };

  const handlePickFile = async () => {
    if (!user || !relationship) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setIsSendingMedia(true);
      const ext = asset.name?.split('.').pop() ?? 'bin';
      const path = `${relationship.id}/${user.id}-file-${Date.now()}.${ext}`;
      const contentType = asset.mimeType ?? 'application/octet-stream';
      const fileUrl = await api.uploadChatMedia(path, asset.uri, contentType);
      const content = encodeAttachment({
        type: 'file',
        name: asset.name ?? 'File',
        url: fileUrl,
        mimeType: asset.mimeType ?? undefined,
      });
      await sendAttachmentMessage(content);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setIsSendingMedia(false);
    }
  };

  const handlePickContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow access to contacts in Settings.');
        return;
      }

      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return;

      const displayName =
        [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || contact.name || 'Contact';
      const phone = contact.phoneNumbers?.[0]?.number?.trim();
      const email = contact.emails?.[0]?.email?.trim();

      if (!phone && !email) {
        Alert.alert('No contact details', 'That contact has no phone number or email to share.');
        return;
      }

      const content = encodeAttachment({
        type: 'contact',
        name: displayName,
        phone: phone || undefined,
        email: email || undefined,
      });
      await sendAttachmentMessage(content);
    } catch (e) {
      Alert.alert('Contact failed', e instanceof Error ? e.message : 'Please try again');
    }
  };

  const handlePickLocation = async () => {
    setIsSendingMedia(true);
    try {
      const result = await getCurrentPlace();
      if (!result.ok) {
        if (result.message) Alert.alert('Location unavailable', result.message);
        return;
      }

      const content = encodeAttachment({
        type: 'location',
        label: result.place.label,
        latitude: result.place.latitude,
        longitude: result.place.longitude,
      });
      await sendAttachmentMessage(content);
    } catch (e) {
      Alert.alert('Location failed', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setIsSendingMedia(false);
    }
  };

  // ─── Voice recording ─────────────────────────────────────────────────────
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (!isRecordingRef.current) return;
      try {
        audioRecorder.stop().catch(() => null);
      } catch {
        /* native recorder may already be released on unmount */
      }
      setAudioModeAsync({ allowsRecording: false }).catch(() => null);
    };
  }, [audioRecorder]);

  useEffect(() => {
    if (!isRecording) {
      setRecordingElapsed(0);
      return;
    }

    const started = Date.now();
    const timer = setInterval(() => {
      setRecordingElapsed(Math.floor((Date.now() - started) / 1000));
    }, 250);
    return () => clearInterval(timer);
  }, [isRecording]);

  /** Starts recording; resolves true once the mic is live. */
  const startRecording = async (): Promise<boolean> => {
    if (isRecordingRef.current) return true;
    try {
      if (!(await ensurePermission('microphone'))) return false;

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      isRecordingRef.current = true;
      setRecordingElapsed(0);
      setShowAttachment(false);
      setShowEmoji(false);
      inputRef.current?.blur();
      setIsRecording(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return true;
    } catch (e) {
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => null);
      Alert.alert('Recording failed', e instanceof Error ? e.message : 'Please try again');
      return false;
    }
  };

  /** Stops the recorder and returns the file (null if nothing usable). */
  const finishRecording = async (): Promise<string | null> => {
    if (!isRecordingRef.current) return null;
    isRecordingRef.current = false;
    setIsRecording(false);
    setHoldingMic(false);
    setRecordingElapsed(0);
    try {
      await audioRecorder.stop();
      // Back to playback mode, still audible with the silent switch on.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      return audioRecorder.uri;
    } catch {
      return null;
    }
  };

  const stopAndSendRecording = async () => {
    if (!user || !relationship) return;
    const uri = await finishRecording();
    if (!uri) {
      Alert.alert('Recording failed', 'Nothing was recorded. Please try again.');
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await sendLocalMedia(uri, 'voice', '🎙 Voice message');
  };

  const cancelRecording = async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await finishRecording();
  };

  /**
   * Mic: press starts recording straight away. A quick tap leaves it running
   * hands-free (delete or Send in the bar); holding it is walkie-talkie —
   * let go to send (a hold under a second is discarded as a slip).
   */
  const onMicPressIn = () => {
    if (isRecordingRef.current) return;
    micPressedAt.current = Date.now();
    setHoldingMic(true);
    recordingStart.current = startRecording();
  };

  const onMicPressOut = async () => {
    const heldMs = Date.now() - micPressedAt.current;
    const started = (await recordingStart.current) ?? false;
    recordingStart.current = null;
    setHoldingMic(false);
    if (!started) return;
    if (heldMs < MIC_HOLD_MS) return; // tapped: keep recording hands-free
    if (heldMs < MIN_HOLD_RECORD_MS) {
      void cancelRecording();
      return;
    }
    void stopAndSendRecording();
  };

  const startCall = useStartCall();

  useEffect(() => {
    if (!pendingScrollMessageId) return;
    const index = listItems.findIndex(
      (item) =>
        (item.type === 'message' && item.id === pendingScrollMessageId) ||
        (item.type === 'unread' && item.id === pendingScrollMessageId),
    );
    if (index < 0) {
      if (hasNextPage && !isFetchingNextPage && !loadingOlderRef.current) {
        loadingOlderRef.current = true;
        void fetchNextPage().finally(() => {
          loadingOlderRef.current = false;
        });
      } else if (!hasNextPage && !isFetchingNextPage) {
        setPendingScrollMessageId(null);
      }
      return;
    }
    const target = listItems[index];
    setPendingScrollMessageId(null);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    });
    if (target.type === 'message') {
      // After the scroll settles, flash it; clear so the same message can flash again.
      setTimeout(() => setHighlightId(target.id), 350);
      setTimeout(() => setHighlightId((id) => (id === target.id ? null : id)), 2000);
    }
  }, [pendingScrollMessageId, listItems, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const scrollToMessage = useCallback((messageId: string) => {
    setPendingScrollMessageId(messageId);
  }, []);

  const onListScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isPending) return;

      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      nearBottomRef.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 120;

      if (contentOffset.y < 80 && hasNextPage && !isFetchingNextPage && !loadingOlderRef.current) {
        loadingOlderRef.current = true;
        void fetchNextPage().finally(() => {
          loadingOlderRef.current = false;
        });
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage, isPending],
  );

  const closeChat = useCallback(() => {
    closeStackScreen(router);
  }, [router]);

  const hasText = text.trim().length > 0;
  const canLoadMessages = !!relationship?.id && !!user?.id;
  const showMessagesLoader = canLoadMessages && messages.length === 0 && (isPending || isFetching) && !isOffline;
  const showMessagesError = (isError || isOffline) && messages.length === 0;
  const messagesErrorText = isOffline
    ? 'You appear to be offline. Messages will load when you reconnect.'
    : "Couldn't load messages.";
  const listPad = 8;
  const inputBarPad = 6;
  const keyboardLift = keyboardHeight;
  const composerBottomPad = keyboardVisible ? inputBarPad : Math.max(insets.bottom, inputBarPad);

  const startReply = useCallback((message: Message) => {
    setSelected(null);
    setReplyTo(message);
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const showProfileIntro = allMessages.length === 0;

  const profileIntro = useMemo(
    () =>
      showProfileIntro ? (
        <ChatEmptyProfile
          partner={partner}
          relationship={relationship}
          isOnline={partnerOnline}
          onOpenProfile={openPartnerProfileView}
          onPickStarter={(line) => {
            setText(line);
            inputRef.current?.focus();
          }}
        />
      ) : null,
    [showProfileIntro, partner, relationship, partnerOnline, openPartnerProfileView],
  );

  const renderItem = ({ item }: { item: ChatListItem }) => {
    if (item.type === 'date') return <ChatDateSeparator label={item.label} />;
    if (item.type === 'unread') {
      return <ChatUnreadDivider count={unreadBannerCount > 0 ? unreadBannerCount : item.count} />;
    }
    const replyToMessage = item.message.reply_to_id ? (messageById.get(item.message.reply_to_id) ?? null) : null;
    return (
      <ChatBubble
        message={item.message}
        replyToMessage={replyToMessage}
        partner={partner}
        onLongPress={setSelected}
        onSwipeReply={startReply}
        highlighted={highlightId === item.message.id}
      />
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.flex}>
        <View
          {...closeOnTap}
          style={[
            styles.header,
            {
              paddingTop: insets.top + 6,
              backgroundColor: colors.background,
              borderBottomColor: colors.border,
            },
          ]}>
          <View style={styles.headerProfile}>
            <View style={styles.headerBackSlot}>
              <HeaderIconButton icon="chevronLeft" onPress={closeChat} accessibilityLabel="Close chat" />
            </View>
            <Pressable
              onPress={() => setShowPartnerPhoto(true)}
              accessibilityRole="button"
              accessibilityLabel="View profile photo">
              <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={40} />
            </Pressable>
            <Pressable
              style={styles.headerText}
              onPress={openPartnerProfileView}
              accessibilityRole="button"
              accessibilityLabel="View partner info">
              <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
                {partner?.name ?? 'Partner'}
              </Text>
              <PartnerStatusLine
                isTyping={partnerTyping}
                isOnline={partnerOnline}
                lastSeenAt={partnerLastSeenAt}
                statusHidden={partnerStatusHidden}
              />
            </Pressable>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={() => startCall('video')}
              hitSlop={8}
              style={styles.headerIconSlot}
              accessibilityRole="button"
              accessibilityLabel="Video call">
              <Icon name="videocam" size={27} color={colors.accent} />
            </Pressable>
            <Pressable
              onPress={() => startCall('audio')}
              hitSlop={8}
              style={styles.headerIconSlot}
              accessibilityRole="button"
              accessibilityLabel="Voice call">
              <Icon name="call" size={25} color={colors.accent} />
            </Pressable>
          </View>
        </View>

        {/* ── Pinned bar ── */}
        {shownPin && (
          <Pressable
            onPress={() => {
              scrollToMessage(shownPin.id);
              if (pinned.length > 1) setPinCursor((c) => (c + 1) % pinned.length);
            }}
            onLongPress={() => setSelected(shownPin)}
            accessibilityRole="button"
            accessibilityLabel={`Pinned message ${shownPinIndex + 1} of ${pinned.length}: ${messagePreviewLabel(shownPin)}`}
            style={[styles.pinnedBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            {/* One mark per pin; the bright one is the pin shown. */}
            <View style={styles.pinMarks}>
              {pinned.map((m, i) => (
                <View
                  key={m.id}
                  style={[
                    styles.pinMark,
                    { backgroundColor: i === shownPinIndex ? colors.accent : colors.border },
                  ]}
                />
              ))}
            </View>
            <View style={styles.pinnedBody}>
              <Text style={[styles.pinnedLabel, { color: colors.accent }]} numberOfLines={1}>
                {pinned.length > 1 ? `Pinned message ${shownPinIndex + 1} of ${pinned.length}` : 'Pinned message'}
              </Text>
              <Text style={[styles.pinnedText, { color: colors.text }]} numberOfLines={1}>
                {messagePreviewLabel(shownPin)}
              </Text>
            </View>
            <Icon name="pin" size={16} color={colors.textSecondary} filled />
          </Pressable>
        )}

        {flushingOffline && (
          <View style={[styles.offlineBar, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.offlineText, { color: colors.accent }]}>Sending queued messages…</Text>
          </View>
        )}

        {/* ── Messages + input (lifted above keyboard) ── */}
        <View style={[styles.flex, { paddingBottom: keyboardLift }]}>
          {/* ── Message area (recorder replaces list while recording) ── */}
          <View style={styles.messageArea} {...closeOnTap}>
            <ChatWallpaper style={styles.flex}>
              {showMessagesLoader ? (
                <LoadingState />
              ) : showMessagesError ? (
                <View style={styles.messagesError}>
                  <Text style={[styles.messagesErrorText, { color: colors.textSecondary }]}>{messagesErrorText}</Text>
                  <Pressable onPress={() => void refetch()} hitSlop={8}>
                    <Text style={[styles.messagesRetry, { color: colors.accent }]}>Tap to retry</Text>
                  </Pressable>
                </View>
              ) : (
                <FlatList
                  ref={listRef}
                  data={listItems}
                  keyExtractor={(item) => item.id}
                  renderItem={renderItem}
                  ListHeaderComponent={
                    isFetchingNextPage ? (
                      <View style={styles.loadOlder}>
                        <Text style={[styles.loadOlderText, { color: colors.textSecondary }]}>
                          Loading earlier messages…
                        </Text>
                      </View>
                    ) : (
                      profileIntro
                    )
                  }
                  style={styles.flex}
                  contentContainerStyle={[
                    styles.list,
                    { paddingTop: listPad, paddingBottom: listPad },
                    showProfileIntro && !isFetchingNextPage && styles.listWithProfileIntro,
                  ]}
                  maintainVisibleContentPosition={{ minIndexForVisible: 1, autoscrollToTopThreshold: 24 }}
                  onScroll={onListScroll}
                  scrollEventThrottle={16}
                  onViewableItemsChanged={onViewableItemsChanged}
                  viewabilityConfig={viewabilityConfig}
                  onScrollToIndexFailed={(info) => {
                    listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
                  }}
                  onContentSizeChange={() => scrollToLatestIfNearBottom(false)}
                  onLayout={() => scrollToLatestIfNearBottom(false)}
                  showsVerticalScrollIndicator={false}
                  keyboardDismissMode="interactive"
                  keyboardShouldPersistTaps="handled"
                />
              )}

              {partnerTyping && (
                <View style={styles.typingBubble}>
                  <TypingIndicator />
                </View>
              )}
            </ChatWallpaper>
          </View>

          {/* ── Media sending indicator ── */}
          {isSendingMedia && (
            <View style={[styles.offlineBar, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.offlineText, { color: colors.accent }]}>Sending…</Text>
            </View>
          )}

          {/* ── Moment reply composer chip ── */}
          {chatMomentReply && (
            <View style={[styles.momentReplyBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
              {chatMomentReply.mediaUrl ? (
                <Image source={{ uri: chatMomentReply.mediaUrl }} style={styles.momentReplyThumb} contentFit="cover" />
              ) : (
                <View style={[styles.momentReplyThumb, { backgroundColor: colors.surfaceElevated }]} />
              )}
              <View style={styles.momentReplyMeta}>
                <Text style={[styles.momentReplyTitle, { color: colors.text }]}>Replying to moment</Text>
                <Text style={[styles.momentReplySub, { color: colors.textSecondary }]}>Attached to your message</Text>
              </View>
              <Pressable
                hitSlop={8}
                onPress={() => setChatMomentReply(null)}
                accessibilityLabel="Remove moment attachment">
                <Icon name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          )}

          {editing && user ? (
            <ChatReplyBar message={editing} partner={partner} userId={user.id} mode="edit" onClose={cancelEdit} />
          ) : null}
          {!editing && replyTo && user && (
            <ChatReplyBar message={replyTo} partner={partner} userId={user.id} onClose={() => setReplyTo(null)} />
          )}

          {/* ── Composer (attachment tray + input + emoji) ── */}
          <View
            style={[
              styles.composer,
              {
                paddingBottom: composerBottomPad,
                borderTopColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}>
            {showAttachment && !isRecording && (
              <ChatAttachmentSheet
                onClose={() => setShowAttachment(false)}
                onPickGallery={handlePickGallery}
                onPickFile={handlePickFile}
                onPickContact={handlePickContact}
                onPickLocation={handlePickLocation}
              />
            )}

            <View
              style={[
                styles.inputBar,
                {
                  backgroundColor: colors.background,
                  paddingTop: inputBarPad,
                  paddingBottom: inputBarPad,
                },
              ]}>
              {isRecording ? (
                <View style={styles.flex}>
                  <ChatVoiceRecorder
                    elapsedSec={recordingElapsed}
                    metering={recorderState.metering}
                    holding={holdingMic}
                    onCancel={() => void cancelRecording()}
                    onSend={() => void stopAndSendRecording()}
                  />
                </View>
              ) : (
                <>
                  {/* Gallery — tap to pick a photo/video directly; long-press for the
                full attachment sheet (file, contact, location). */}
                  <Pressable
                    hitSlop={8}
                    style={styles.inputSideBtn}
                    disabled={isRecording}
                    delayLongPress={350}
                    accessibilityLabel={showAttachment ? 'Close attachments' : 'Add photo or video'}
                    accessibilityHint={showAttachment ? undefined : 'Long press for more attachment options'}
                    onPress={() => {
                      if (showAttachment) {
                        setShowAttachment(false);
                        return;
                      }
                      void handlePickGallery();
                    }}
                    onLongPress={() => {
                      if (showAttachment) return;
                      inputRef.current?.blur();
                      setShowEmoji(false);
                      setShowAttachment(true);
                      scrollToLatest(true);
                    }}>
                    <Icon
                      name={showAttachment ? 'close' : 'image'}
                      size={showAttachment ? 26 : 28}
                      color={showAttachment ? colors.accent : colors.text}
                    />
                  </Pressable>

                  {/* Pill: text input + emoji toggle */}
                  <View style={[styles.inputPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TextInput
                      ref={inputRef}
                      style={[styles.input, { color: colors.text }]}
                      placeholder="Message"
                      placeholderTextColor={colors.textTertiary}
                      value={text}
                      onChangeText={onChangeText}
                      editable={!isRecording}
                      multiline
                      maxLength={2000}
                      onFocus={() => {
                        setShowEmoji(false);
                        setShowAttachment(false);
                        scrollToLatest(true);
                      }}
                    />
                    <Pressable
                      hitSlop={8}
                      style={styles.emojiBtn}
                      accessibilityLabel="Emoji picker"
                      onPress={toggleEmoji}>
                      <Icon
                        name="sticker"
                        size={26}
                        color={showEmoji ? colors.accent : colors.text}
                        filled={showEmoji}
                      />
                    </Pressable>
                  </View>

                  {!hasText && !isRecording && (
                    <Pressable
                      hitSlop={8}
                      style={styles.inputSideBtn}
                      accessibilityLabel="Open camera"
                      onPress={openCamera}>
                      <Icon name="camera" size={28} color={colors.text} />
                    </Pressable>
                  )}
                </>
              )}

              {/* Send / Mic. Mic: tap to record hands-free, or hold and let go to
              send. It stays mounted while held so letting go always registers;
              in hands-free mode the recorder bar has its own Send. */}
              {!isRecording || holdingMic ? (
                <Pressable
                  onPress={hasText ? handleSend : undefined}
                  onPressIn={!hasText ? onMicPressIn : undefined}
                  onPressOut={!hasText ? () => void onMicPressOut() : undefined}
                  hitSlop={8}
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor: hasText || isRecording ? colors.accent : 'transparent',
                    },
                  ]}
                  accessibilityLabel={hasText ? 'Send' : 'Record a voice message'}
                  accessibilityHint={hasText ? undefined : 'Tap to record, or hold and release to send'}>
                  <Icon
                    name={hasText ? 'send' : 'mic'}
                    size={hasText ? 22 : 27}
                    color={hasText || isRecording ? colors.onAccent : colors.text}
                    filled={hasText || isRecording}
                  />
                </Pressable>
              ) : null}
            </View>

            {showEmoji && <ChatEmojiPicker onSelect={handleEmojiSelect} onBackspace={handleEmojiBackspace} />}
          </View>
        </View>
      </View>

      <ChatMessageActionSheet
        message={selected}
        onClose={() => setSelected(null)}
        onReply={startReply}
        onEdit={startEdit}
        onReact={(messageId, emoji) => react.mutate({ messageId, emoji })}
        onPin={togglePin}
        onDeleteForMe={(messageId) => deleteForMe.mutate(messageId)}
        onDeleteForAll={(messageId) => deleteForAll.mutate(messageId)}
      />

      <ChatCameraModal visible={showCamera} onClose={() => setShowCamera(false)} onCapture={handleCameraCapture} />

      <FullScreenImageModal
        visible={showPartnerPhoto}
        imageUrl={partner?.avatar_url}
        fallbackName={partner?.name}
        title={partner?.name ?? 'Partner'}
        onClose={() => setShowPartnerPhoto(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  messageArea: { flex: 1, minHeight: 0 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    paddingRight: 8,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerIconSlot: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  // Tight to the avatar — the 44pt tap area already gives the icon breathing room.
  headerBackSlot: { marginRight: -6 },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },

  pinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pinMarks: { alignSelf: 'stretch', justifyContent: 'center', gap: 3 },
  pinMark: { width: 3, flex: 1, maxHeight: 34, borderRadius: 1.5 },
  pinnedBody: { flex: 1, minWidth: 0, gap: 1 },
  pinnedLabel: { fontSize: 12, fontWeight: '800' },
  pinnedText: { fontSize: 14 },

  offlineBar: { padding: 8, alignItems: 'center' },
  offlineText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // List
  list: { paddingHorizontal: 2, flexGrow: 1 },
  listWithProfileIntro: { justifyContent: 'center' },
  loadOlder: { paddingVertical: 12, alignItems: 'center' },
  loadOlderText: { fontSize: 12, fontWeight: '600' },
  messagesError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  messagesErrorText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  messagesRetry: { fontSize: 14, fontWeight: '700' },

  // Typing bubble
  typingBubble: { paddingHorizontal: 12, paddingBottom: 8 },

  momentReplyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  momentReplyThumb: { width: 44, height: 44, borderRadius: 10 },
  momentReplyMeta: { flex: 1, gap: 2 },
  momentReplyTitle: { fontSize: 13, fontWeight: '700' },
  momentReplySub: { fontSize: 11, fontWeight: '600' },

  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 6,
    gap: 4,
  },
  inputSideBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 22,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 44,
    maxHeight: 130,
    marginBottom: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, fontSize: 16, maxHeight: 120, paddingVertical: 12, paddingRight: 4 },
  emojiBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
