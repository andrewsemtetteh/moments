import { useQueryClient } from '@tanstack/react-query';
import {
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioRecorder,
} from 'expo-audio';
import * as Contacts from 'expo-contacts/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    PanResponder,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';
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
import { LoadingState } from '@/components/home/MoodSnapshot';
import { SwipeDismissView } from '@/components/layout/SwipeDismissView';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import {
    applyMessagesReadInCache,
    useInfiniteMessages,
    useMessageActions,
    useSendMessage,
} from '@/hooks/queries';
import { useOpenPartnerProfile } from '@/hooks/useOpenPartnerProfile';
import { usePartnerPresence } from '@/hooks/usePartnerPresence';
import { useStartCall } from '@/hooks/useStartCall';
import { useTheme } from '@/hooks/useTheme';
import { encodeAttachment } from '@/lib/chat-attachments';
import { buildChatListItems, type ChatListItem } from '@/lib/chat-list';
import { messagePreviewLabel } from '@/lib/chat-media';
import { flushChatOfflineQueue } from '@/lib/chat-offline-flush';
import { getCurrentPlace } from '@/lib/location';
import { goBackOrReplace } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import * as api from '@/services/api';
import { useAuthStore, useOfflineStore, useRelationshipStore, useUIStore } from '@/stores';
import type { Message } from '@/types/database';

/** Distance from top of screen to top of KAV (safe area + header row height). */
const HEADER_CONTENT_HEIGHT = 54;

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
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
  const offlineQueue = useOfflineStore((s) => s.queue);
  const addToQueue = useOfflineStore((s) => s.addToQueue);
  const removeFromQueue = useOfflineStore((s) => s.removeFromQueue);
  const hydrateOfflineQueue = useOfflineStore((s) => s.hydrateQueue);

  // Text
  const [text, setText] = useState('');
  // UI
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachment, setShowAttachment] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [initialUnreadIds, setInitialUnreadIds] = useState<Set<string> | null>(null);
  // Recording
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [willCancelRecording, setWillCancelRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const isRecordingRef = useRef(false);
  const willCancelRecordingRef = useRef(false);
  const [isSendingMedia, setIsSendingMedia] = useState(false);
  const [flushingOffline, setFlushingOffline] = useState(false);
  const [pendingScrollMessageId, setPendingScrollMessageId] = useState<string | null>(null);

  const listRef = useRef<FlatList>(null);
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingChannelReady = useRef(false);
  const lastTypingSent = useRef(0);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const loadingOlderRef = useRef(false);
  const nearBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);

  const {
    messages,
    isFetching,
    isPending,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteMessages();
  const { isOnline: partnerOnline, lastSeenAt: partnerLastSeenAt } = usePartnerPresence(
    relationship?.id,
    user?.id,
    partner?.id,
  );
  const sendMessage = useSendMessage();
  const { react, pin, deleteForMe, deleteForAll } = useMessageActions();

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const scrollToLatestIfNearBottom = useCallback(
    (animated = true) => {
      if (!initialScrollDoneRef.current || nearBottomRef.current) {
        scrollToLatest(animated);
        initialScrollDoneRef.current = true;
      }
    },
    [scrollToLatest],
  );

  // Keep messages visible when the keyboard opens
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => scrollToLatest(true),
    );
    return () => showSub.remove();
  }, [scrollToLatest]);

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

  // Snapshot unread IDs on first load for the "UNREAD" divider
  useEffect(() => {
    if (!messages || !user || initialUnreadIds !== null) return;
    const unread = new Set(
      messages.filter((m) => m.sender_id !== user.id && !m.read_at).map((m) => m.id),
    );
    setInitialUnreadIds(unread);
  }, [messages, user, initialUnreadIds]);

  // Mark messages read after a short delay so unread styling / divider are visible first.
  useEffect(() => {
    if (!relationship || !user || messages.length === 0) return;
    const hasPartnerUnread = messages.some((m) => m.sender_id !== user.id && !m.read_at);
    if (!hasPartnerUnread) return;

    const timer = setTimeout(() => {
      void api.markMessagesRead(relationship.id, user.id).then(() => {
        applyMessagesReadInCache(queryClient, relationship.id, user.id);
        queryClient.invalidateQueries({ queryKey: ['unreadMessages', relationship.id, user.id] });
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [relationship, user, messages, queryClient]);

  // Typing broadcast
  useEffect(() => {
    if (!relationship?.id || !user?.id) return;
    const ch = supabase.channel(`typing:${relationship.id}`, {
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
      supabase.removeChannel(ch);
      typingChannel.current = null;
    };
  }, [relationship?.id, user?.id]);

  // Flush durable offline queue sequentially when back online
  useEffect(() => {
    if (isOffline || offlineQueue.length === 0 || !relationship || !user || flushingOffline) return;

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
      .then(() => refetch())
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
  ]);

  const allMessages = useMemo(
    () => [...messages, ...optimisticMessages],
    [messages, optimisticMessages],
  );
  const messageById = useMemo(
    () => new Map(allMessages.map((message) => [message.id, message])),
    [allMessages],
  );
  const pinned = useMemo(
    () => messages.filter((m) => m.is_pinned && !m.deleted_for_all),
    [messages],
  );
  const latestPinned = pinned[pinned.length - 1] ?? null;
  const listItems = useMemo(() => {
    if (!user) return [];
    return buildChatListItems(allMessages, user.id, initialUnreadIds ?? undefined);
  }, [allMessages, user, initialUnreadIds]);

  // ─── Text send ───────────────────────────────────────────────────────────
  const onChangeText = (t: string) => {
    setText(t);
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

  const handleSend = useCallback(async () => {
    if (!text.trim() || !user || !relationship) return;
    const content = text.trim();
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

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      relationship_id: relationship.id,
      sender_id: user.id,
      content,
      media_url: momentPayload.mediaUrl ?? null,
      media_type: momentPayload.mediaType ?? null,
      moment_id: momentPayload.momentId ?? null,
      reply_to_id: replyToId ?? null,
      reactions: {},
      is_pinned: false,
      deleted_for_all: false,
      hidden_for: [],
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setOptimisticMessages((prev) => [...prev, optimistic]);
    nearBottomRef.current = true;

    if (isOffline) {
      addToQueue(
        {
          id: optimistic.id,
          type: 'message',
          payload: { content, ...momentPayload, replyToId },
        },
        relationship.id,
      );
      return;
    }
    try {
      await sendMessage.mutateAsync({ content, ...momentPayload, replyToId });
      await api.trackEvent(relationship.id, user.id, 'message_sent');
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } catch {
      addToQueue(
        {
          id: optimistic.id,
          type: 'message',
          payload: { content, ...momentPayload, replyToId },
        },
        relationship.id,
      );
    }
  }, [text, user, relationship, chatMomentReply, replyTo, isOffline, sendMessage, addToQueue, setChatMomentReply]);

  // ─── Emoji insert ─────────────────────────────────────────────────────────
  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  const toggleEmoji = () => {
    if (!showEmoji) {
      inputRef.current?.blur();
      setShowAttachment(false);
    }
    setShowEmoji((v) => !v);
  };

  // ─── Image / Camera ───────────────────────────────────────────────────────
  const sendImageMessage = async (uri: string, mediaType: 'image' | 'video') => {
    if (!user || !relationship) return;
    setIsSendingMedia(true);
    try {
      if (isOffline) {
        addToQueue(
          {
            id: `temp-${Date.now()}`,
            type: 'message',
            payload: { content: '', mediaLocalUri: uri, mediaType },
          },
          relationship.id,
        );
        return;
      }

      const ext = uri.split('.').pop() ?? 'jpg';
      const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
      const path = `${relationship.id}/${user.id}-${Date.now()}.${ext}`;
      const mediaUrl = await api.uploadChatMedia(path, uri, contentType);

      const optimistic: Message = {
        id: `temp-${Date.now()}`,
        relationship_id: relationship.id,
        sender_id: user.id,
        content: '',
        media_url: mediaUrl,
        media_type: mediaType,
        moment_id: null,
        reply_to_id: null,
        reactions: {},
        is_pinned: false,
        deleted_for_all: false,
        hidden_for: [],
        read_at: null,
        created_at: new Date().toISOString(),
      };
      setOptimisticMessages((prev) => [...prev, optimistic]);

      await sendMessage.mutateAsync({ content: '', mediaUrl, mediaType });
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } catch (e) {
      addToQueue(
        {
          id: `temp-${Date.now()}`,
          type: 'message',
          payload: { content: '', mediaLocalUri: uri, mediaType },
        },
        relationship.id,
      );
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Queued to send when online.');
    } finally {
      setIsSendingMedia(false);
    }
  };

  const handlePickGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Allow access to your photo library in Settings.');
      return;
    }
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

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      relationship_id: relationship.id,
      sender_id: user.id,
      content,
      media_url: null,
      media_type: null,
      moment_id: null,
      reply_to_id: replyToId ?? null,
      reactions: {},
      is_pinned: false,
      deleted_for_all: false,
      hidden_for: [],
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setOptimisticMessages((prev) => [...prev, optimistic]);

    if (isOffline) {
      addToQueue({ id: optimistic.id, type: 'message', payload: { content, replyToId } }, relationship.id);
      return;
    }

    try {
      await sendMessage.mutateAsync({ content, replyToId });
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } catch {
      addToQueue({ id: optimistic.id, type: 'message', payload: { content, replyToId } }, relationship.id);
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
        [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() ||
        contact.name ||
        'Contact';
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
        Alert.alert('Location unavailable', result.message);
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
    willCancelRecordingRef.current = willCancelRecording;
  }, [willCancelRecording]);

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

  const recordPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => isRecordingRef.current,
        onPanResponderMove: (_, gesture) => {
          setWillCancelRecording(gesture.dx < -60);
        },
      }),
    [],
  );

  const startRecording = async () => {
    try {
      if (isRecording) {
        try {
          await audioRecorder.stop();
        } catch {
          /* ignore */
        }
        setIsRecording(false);
      }

      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          'Microphone access required',
          'Go to Settings and enable microphone access for Moments to send voice messages.',
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setWillCancelRecording(false);
      setRecordingElapsed(0);
      setShowAttachment(false);
      setShowEmoji(false);
      inputRef.current?.blur();
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      setAudioModeAsync({ allowsRecording: false }).catch(() => null);
      Alert.alert('Recording failed', e instanceof Error ? e.message : 'Please try again');
    }
  };

  const stopAndSendRecording = async () => {
    if (!isRecording || !user || !relationship) return;
    setIsRecording(false);
    setWillCancelRecording(false);
    setRecordingElapsed(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let uri: string | null = null;
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      uri = audioRecorder.uri;
      if (!uri) return;

      if (isOffline) {
        addToQueue(
          {
            id: `temp-${Date.now()}`,
            type: 'message',
            payload: { content: '🎙 Voice message', mediaLocalUri: uri, mediaType: 'voice' },
          },
          relationship.id,
        );
        return;
      }

      setIsSendingMedia(true);
      const path = `${relationship.id}/${user.id}-voice-${Date.now()}.m4a`;
      const mediaUrl = await api.uploadChatMedia(path, uri, 'audio/mp4');

      const optimistic: Message = {
        id: `temp-${Date.now()}`,
        relationship_id: relationship.id,
        sender_id: user.id,
        content: '🎙 Voice message',
        media_url: mediaUrl,
        media_type: 'voice',
        moment_id: null,
        reply_to_id: null,
        reactions: {},
        is_pinned: false,
        deleted_for_all: false,
        hidden_for: [],
        read_at: null,
        created_at: new Date().toISOString(),
      };
      setOptimisticMessages((prev) => [...prev, optimistic]);
      nearBottomRef.current = true;
      await sendMessage.mutateAsync({ content: '🎙 Voice message', mediaUrl, mediaType: 'voice' });
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } catch (e) {
      if (uri) {
        addToQueue(
          {
            id: `temp-${Date.now()}`,
            type: 'message',
            payload: { content: '🎙 Voice message', mediaLocalUri: uri, mediaType: 'voice' },
          },
          relationship.id,
        );
        Alert.alert('Send failed', 'Queued to send when online.');
      } else {
        Alert.alert('Send failed', e instanceof Error ? e.message : 'Please try again');
      }
    } finally {
      setIsSendingMedia(false);
    }
  };

  const cancelRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    setWillCancelRecording(false);
    setRecordingElapsed(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
    } catch {/* ignore */}
  };

  const handleMicRelease = () => {
    if (!isRecording) return;
    if (willCancelRecordingRef.current) void cancelRecording();
    else void stopAndSendRecording();
    setWillCancelRecording(false);
  };

  const startCall = useStartCall();

  useEffect(() => {
    if (!pendingScrollMessageId) return;
    const index = listItems.findIndex(
      (item) => item.type === 'message' && item.id === pendingScrollMessageId,
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
    setPendingScrollMessageId(null);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    });
  }, [pendingScrollMessageId, listItems, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const scrollToMessage = useCallback((messageId: string) => {
    setPendingScrollMessageId(messageId);
  }, []);

  const onListScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isPending) return;

      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      nearBottomRef.current =
        contentOffset.y + layoutMeasurement.height >= contentSize.height - 120;

      if (
        contentOffset.y < 80 &&
        hasNextPage &&
        !isFetchingNextPage &&
        !loadingOlderRef.current
      ) {
        loadingOlderRef.current = true;
        void fetchNextPage().finally(() => {
          loadingOlderRef.current = false;
        });
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage, isPending],
  );

  const closeChat = useCallback(() => {
    goBackOrReplace(router, '/(tabs)/home');
  }, [router]);

  const hasText = text.trim().length > 0;
  const canLoadMessages = !!relationship?.id && !!user?.id;
  const showMessagesLoader =
    canLoadMessages && messages.length === 0 && (isPending || isFetching) && !isOffline;
  const showMessagesError = (isError || isOffline) && messages.length === 0;
  const messagesErrorText = isOffline
    ? 'You appear to be offline. Messages will load when you reconnect.'
    : "Couldn't load messages.";
  const kbOffset = Platform.OS === 'ios' ? insets.top + HEADER_CONTENT_HEIGHT : 0;
  const listPad = 8;
  const inputBarPad = 6;

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
          isTyping={partnerTyping}
          isOnline={partnerOnline}
          lastSeenAt={partnerLastSeenAt}
          onOpenProfile={openPartnerProfileView}
          onOpenAvatar={openPartnerProfileView}
        />
      ) : null,
    [
      showProfileIntro,
      partner,
      relationship,
      partnerTyping,
      partnerOnline,
      partnerLastSeenAt,
      openPartnerProfileView,
    ],
  );

  const renderItem = ({ item }: { item: ChatListItem }) => {
    if (item.type === 'date') return <ChatDateSeparator label={item.label} />;
    if (item.type === 'unread') return <ChatUnreadDivider count={item.count} />;
    const replyToMessage = item.message.reply_to_id
      ? messageById.get(item.message.reply_to_id) ?? null
      : null;
    return (
      <ChatBubble
        message={item.message}
        replyToMessage={replyToMessage}
        partner={partner}
        isUnread={
          !!user &&
          item.message.sender_id !== user.id &&
          (initialUnreadIds?.has(item.message.id) ?? !item.message.read_at)
        }
        onLongPress={setSelected}
        onSwipeReply={startReply}
      />
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SwipeDismissView edge="end" onDismiss={closeChat} style={styles.flex}>
        <View style={[styles.shell, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 6,
              backgroundColor: colors.background,
              borderBottomColor: colors.border,
            },
          ]}>
          <Pressable
            style={styles.headerProfile}
            onPress={openPartnerProfileView}
            accessibilityRole="button"
            accessibilityLabel="View partner info">
            <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={40} />
            <View style={styles.headerText}>
              <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
                {partner?.name ?? 'Partner'}
              </Text>
              <PartnerStatusLine
                isTyping={partnerTyping}
                isOnline={partnerOnline}
                lastSeenAt={partnerLastSeenAt}
              />
            </View>
          </Pressable>

          <View style={styles.headerActions}>
            <Pressable onPress={() => startCall('video')} hitSlop={8} style={styles.headerIconSlot}>
              <Icon name="videocam" size={24} color={colors.accent} />
            </Pressable>
            <Pressable onPress={() => startCall('audio')} hitSlop={8} style={styles.headerIconSlot}>
              <Icon name="call" size={22} color={colors.accent} />
            </Pressable>
            <Pressable
              onPress={closeChat}
              hitSlop={10}
              accessibilityLabel="Close chat"
              style={styles.headerCloseBtn}>
              <Icon name="chevronRight" size={26} color={colors.accent} />
            </Pressable>
          </View>
        </View>

      {/* ── Pinned bar ── */}
      {latestPinned && (
        <Pressable
          onPress={() => scrollToMessage(latestPinned.id)}
          style={[styles.pinnedBar, { backgroundColor: colors.accentSoft, borderBottomColor: colors.border }]}>
          <Icon name="pin" size={14} color={colors.accent} filled />
          <Text style={[styles.pinnedText, { color: colors.text }]} numberOfLines={1}>
            {messagePreviewLabel(latestPinned)}
          </Text>
          {pinned.length > 1 ? (
            <Text style={[styles.pinnedCount, { color: colors.textSecondary }]}>{pinned.length}</Text>
          ) : null}
        </Pressable>
      )}

      {/* ── Offline banner ── */}
      {isOffline && (
        <View style={[styles.offlineBar, { backgroundColor: colors.warning }]}>
          <Text style={styles.offlineText}>
            Offline — {offlineQueue.length} message{offlineQueue.length === 1 ? '' : 's'} will send when reconnected
          </Text>
        </View>
      )}
      {flushingOffline && (
        <View style={[styles.offlineBar, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.offlineText, { color: colors.accent }]}>Sending queued messages…</Text>
        </View>
      )}

      {/* ── KAV wraps messages + input ── */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={kbOffset}>
        {/* ── Message area (recorder replaces list while recording) ── */}
        <View style={styles.messageArea}>
          {isRecording ? (
            <ChatVoiceRecorder
              elapsedSec={recordingElapsed}
              willCancel={willCancelRecording}
              panHandlers={recordPanResponder.panHandlers}
              onCancel={() => void cancelRecording()}
            />
          ) : (
            <ChatWallpaper style={styles.flex}>
              {showMessagesLoader ? (
                <LoadingState />
              ) : showMessagesError ? (
                <View style={styles.messagesError}>
                  <Text style={[styles.messagesErrorText, { color: colors.textSecondary }]}>
                    {messagesErrorText}
                  </Text>
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
                  <View style={[styles.typingPill, { backgroundColor: colors.chatBubblePartner, borderColor: colors.border }]}>
                    <Text style={[styles.typingDots, { color: colors.textSecondary }]}>● ● ●</Text>
                  </View>
                </View>
              )}
            </ChatWallpaper>
          )}
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

        {replyTo && user && (
          <ChatReplyBar
            message={replyTo}
            partner={partner}
            userId={user.id}
            onClose={() => setReplyTo(null)}
          />
        )}

        {/* ── Composer (attachment tray + input + emoji) ── */}
        <View
          style={[
            styles.composer,
            { paddingBottom: insets.bottom, borderTopColor: colors.border, backgroundColor: colors.background },
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
          {/* + Attachment */}
          <Pressable
            hitSlop={8}
            style={styles.inputSideBtn}
            disabled={isRecording}
            accessibilityLabel={showAttachment ? 'Close attachments' : 'Add attachment'}
            onPress={() => {
              if (!showAttachment) inputRef.current?.blur();
              setShowEmoji(false);
              setShowAttachment((open) => {
                const next = !open;
                if (next) scrollToLatest(true);
                return next;
              });
            }}>
            <Icon
              name={showAttachment ? 'close' : 'plus'}
              size={showAttachment ? 22 : 26}
              color={showAttachment ? colors.accent : colors.textSecondary}
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
                size={22}
                color={showEmoji ? colors.accent : colors.textSecondary}
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
              <Icon name="camera" size={24} color={colors.textSecondary} />
            </Pressable>
          )}

          {/* Send / Mic (hold for voice, tap to send) */}
          <Pressable
            onPress={hasText ? handleSend : undefined}
            onLongPress={!hasText ? () => void startRecording() : undefined}
            onPressOut={!hasText ? handleMicRelease : undefined}
            delayLongPress={300}
            hitSlop={8}
            style={[
              styles.sendBtn,
              {
                backgroundColor: hasText || isRecording ? colors.accent : 'transparent',
              },
            ]}
            accessibilityLabel={hasText ? 'Send' : 'Hold to record voice note'}>
            <Icon
              name={hasText ? 'send' : 'mic'}
              size={22}
              color={hasText || isRecording ? colors.onAccent : colors.textSecondary}
              filled={hasText || isRecording}
            />
          </Pressable>
          </View>

          {showEmoji && <ChatEmojiPicker onSelect={handleEmojiSelect} />}
        </View>
      </KeyboardAvoidingView>
        </View>
      </SwipeDismissView>

      <ChatMessageActionSheet
        message={selected}
        onClose={() => setSelected(null)}
        onReply={startReply}
        onReact={(messageId, emoji) => react.mutate({ messageId, emoji })}
        onPin={(messageId, isPinned) => pin.mutate({ messageId, isPinned })}
        onDeleteForMe={(messageId) => deleteForMe.mutate(messageId)}
        onDeleteForAll={(messageId) => deleteForAll.mutate(messageId)}
      />

      <ChatCameraModal
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  shell: { flex: 1 },
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
  headerCloseBtn: {
    width: 30,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { fontSize: 16, fontWeight: '700' },

  pinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pinnedText: { fontSize: 13, flex: 1 },
  pinnedCount: { fontSize: 12, fontWeight: '700' },

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
  typingPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typingDots: { fontSize: 10, letterSpacing: 3 },

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
    width: 40,
    height: 40,
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
    minHeight: 40,
    maxHeight: 130,
    marginBottom: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, fontSize: 16, maxHeight: 120, paddingVertical: 10, paddingRight: 4 },
  emojiBtn: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
