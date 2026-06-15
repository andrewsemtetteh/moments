import { useQueryClient } from '@tanstack/react-query';
import {
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioRecorder,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatAttachmentSheet } from '@/components/chat/ChatAttachmentSheet';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { ChatEmojiPicker } from '@/components/chat/ChatEmojiPicker';
import { ChatDateSeparator, ChatUnreadDivider } from '@/components/chat/ChatListSeparators';
import { ChatWallpaper } from '@/components/chat/ChatWallpaper';
import { PartnerInfoSheet } from '@/components/chat/PartnerInfoSheet';
import { LoadingState } from '@/components/home/MoodSnapshot';
import { FullScreenImageModal } from '@/components/ui/FullScreenImageModal';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { REACTION_EMOJI } from '@/constants/design-system';
import {
    useMessageActions,
    useMessages,
    useRealtimeSubscription,
    useSendMessage,
} from '@/hooks/queries';
import { useStartCall } from '@/hooks/useStartCall';
import { useTheme } from '@/hooks/useTheme';
import { buildChatListItems, type ChatListItem } from '@/lib/chat-list';
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
  const offlineQueue = useOfflineStore((s) => s.queue);
  const addToQueue = useOfflineStore((s) => s.addToQueue);
  const removeFromQueue = useOfflineStore((s) => s.removeFromQueue);

  // Text
  const [text, setText] = useState('');
  // UI
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [showPartnerInfo, setShowPartnerInfo] = useState(false);
  const [showPartnerAvatar, setShowPartnerAvatar] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachment, setShowAttachment] = useState(false);
  const [initialUnreadIds, setInitialUnreadIds] = useState<Set<string> | null>(null);
  // Recording
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [isSendingMedia, setIsSendingMedia] = useState(false);

  const listRef = useRef<FlatList>(null);
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingChannelReady = useRef(false);
  const lastTypingSent = useRef(0);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const { data: messages, isLoading, refetch } = useMessages();
  const sendMessage = useSendMessage();
  const { react, pin } = useMessageActions();

  useRealtimeSubscription('messages');

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

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

  // Snapshot unread IDs on first load for the "UNREAD" divider
  useEffect(() => {
    if (!messages || !user || initialUnreadIds !== null) return;
    const unread = new Set(
      messages.filter((m) => m.sender_id !== user.id && !m.read_at).map((m) => m.id),
    );
    setInitialUnreadIds(unread);
  }, [messages, user, initialUnreadIds]);

  // Mark messages read, clear badge
  useEffect(() => {
    if (!relationship || !user) return;
    void api.markMessagesRead(relationship.id, user.id).then(() => {
      queryClient.invalidateQueries({ queryKey: ['unreadMessages', relationship.id, user.id] });
    });
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

  // Flush offline queue
  useEffect(() => {
    if (isOffline || offlineQueue.length === 0 || !relationship || !user) return;
    offlineQueue.forEach(async (item) => {
      if (item.type === 'message') {
        const payload = item.payload as {
          content: string;
          momentId?: string;
          mediaUrl?: string;
          mediaType?: string;
        };
        await api.sendMessage(
          relationship.id,
          user.id,
          payload.content,
          payload.mediaUrl,
          payload.mediaType,
          payload.momentId,
        );
        removeFromQueue(item.id);
      }
    });
    refetch();
  }, [isOffline, offlineQueue, relationship, user, removeFromQueue, refetch]);

  const allMessages = useMemo(
    () => [...(messages ?? []), ...optimisticMessages],
    [messages, optimisticMessages],
  );
  const pinned = useMemo(() => (messages ?? []).filter((m) => m.is_pinned), [messages]);
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
    setText('');
    setShowEmoji(false);
    setChatMomentReply(null);

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      relationship_id: relationship.id,
      sender_id: user.id,
      content,
      media_url: momentPayload.mediaUrl ?? null,
      media_type: momentPayload.mediaType ?? null,
      moment_id: momentPayload.momentId ?? null,
      reactions: {},
      is_pinned: false,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setOptimisticMessages((prev) => [...prev, optimistic]);

    if (isOffline) {
      addToQueue({ id: optimistic.id, type: 'message', payload: { content, ...momentPayload } });
      return;
    }
    try {
      await sendMessage.mutateAsync({ content, ...momentPayload });
      await api.trackEvent(relationship.id, user.id, 'message_sent');
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } catch {
      addToQueue({ id: optimistic.id, type: 'message', payload: { content, ...momentPayload } });
    }
  }, [text, user, relationship, chatMomentReply, isOffline, sendMessage, addToQueue, setChatMomentReply]);

  // ─── Emoji insert ─────────────────────────────────────────────────────────
  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  const toggleEmoji = () => {
    if (!showEmoji) inputRef.current?.blur();
    setShowEmoji((v) => !v);
  };

  // ─── Image / Camera ───────────────────────────────────────────────────────
  const sendImageMessage = async (uri: string, mediaType: 'image' | 'video') => {
    if (!user || !relationship) return;
    setIsSendingMedia(true);
    try {
      const ext = uri.split('.').pop() ?? 'jpg';
      const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
      const path = `${relationship.id}/${user.id}-${Date.now()}.${ext}`;
      const publicUrl = await api.uploadMedia('moments-media', path, uri, contentType);

      const optimistic: Message = {
        id: `temp-${Date.now()}`,
        relationship_id: relationship.id,
        sender_id: user.id,
        content: '',
        media_url: publicUrl,
        media_type: mediaType,
        moment_id: null,
        reactions: {},
        is_pinned: false,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      setOptimisticMessages((prev) => [...prev, optimistic]);

      await sendMessage.mutateAsync({ content: '', mediaUrl: publicUrl, mediaType });
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Please try again');
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
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const type = asset.type === 'video' ? 'video' : 'image';
      await sendImageMessage(asset.uri, type);
    }
  };

  const handlePickCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await sendImageMessage(result.assets[0].uri, 'image');
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = audioRecorder.uri;
      if (!uri) return;

      setIsSendingMedia(true);
      const path = `${relationship.id}/${user.id}-voice-${Date.now()}.m4a`;
      const publicUrl = await api.uploadMedia('moments-media', path, uri, 'audio/m4a');

      const optimistic: Message = {
        id: `temp-${Date.now()}`,
        relationship_id: relationship.id,
        sender_id: user.id,
        content: '🎙 Voice message',
        media_url: publicUrl,
        media_type: 'voice',
        moment_id: null,
        reactions: {},
        is_pinned: false,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      setOptimisticMessages((prev) => [...prev, optimistic]);
      await sendMessage.mutateAsync({ content: '🎙 Voice message', mediaUrl: publicUrl, mediaType: 'voice' });
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } catch (e) {
      Alert.alert('Send failed', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setIsSendingMedia(false);
    }
  };

  const cancelRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
    } catch {/* ignore */}
  };

  const startCall = useStartCall();

  const renderItem = ({ item }: { item: ChatListItem }) => {
    if (item.type === 'date') return <ChatDateSeparator label={item.label} />;
    if (item.type === 'unread') return <ChatUnreadDivider count={item.count} />;
    return <ChatBubble message={item.message} onLongPress={setSelected} />;
  };

  const hasText = text.trim().length > 0;
  const kbOffset = Platform.OS === 'ios' ? insets.top + HEADER_CONTENT_HEIGHT : 0;
  const listPad = 8;
  const inputBarPad = 6;

  const openPartnerAvatar = () => {
    if (!partner?.avatar_url?.trim()) return;
    setShowPartnerInfo(false);
    setShowPartnerAvatar(true);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 6,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}>
        <View style={styles.headerSide}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityLabel="Go back"
            style={styles.headerIconSlot}>
            <Icon name="chevronLeft" size={26} color={colors.accent} />
          </Pressable>
        </View>

        <View style={styles.headerCenter}>
          <Pressable
            onPress={openPartnerAvatar}
            disabled={!partner?.avatar_url?.trim()}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="View profile photo">
            <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={34} />
          </Pressable>
          <Pressable
            style={styles.headerText}
            onPress={() => setShowPartnerInfo(true)}
            accessibilityLabel="View partner info">
            <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
              {partner?.name ?? 'Partner'}
            </Text>
            <Text
              style={[
                styles.headerStatus,
                { color: partnerTyping ? colors.accent : colors.textSecondary },
              ]}
              numberOfLines={1}>
              {partnerTyping ? 'typing…' : 'online'}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.headerSide, styles.headerSideRight]}>
          <Pressable onPress={() => startCall('video')} hitSlop={8} style={styles.headerIconSlot}>
            <Icon name="videocam" size={24} color={colors.accent} />
          </Pressable>
          <Pressable onPress={() => startCall('audio')} hitSlop={8} style={styles.headerIconSlot}>
            <Icon name="call" size={22} color={colors.accent} />
          </Pressable>
        </View>
      </View>

      {/* ── Pinned bar ── */}
      {pinned.length > 0 && (
        <View style={[styles.pinnedBar, { backgroundColor: colors.accentSoft, borderBottomColor: colors.border }]}>
          <Icon name="pin" size={14} color={colors.accent} filled />
          <Text style={[styles.pinnedText, { color: colors.text }]} numberOfLines={1}>
            {pinned[pinned.length - 1].content}
          </Text>
        </View>
      )}

      {/* ── Offline banner ── */}
      {isOffline && (
        <View style={[styles.offlineBar, { backgroundColor: colors.warning }]}>
          <Text style={styles.offlineText}>Offline — messages will send when reconnected</Text>
        </View>
      )}

      {/* ── KAV wraps messages + input ── */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={kbOffset}>
        {/* ── Message area ── */}
        <ChatWallpaper style={styles.messageArea}>
          {isLoading ? (
            <LoadingState />
          ) : allMessages.length === 0 ? (
            <View style={styles.empty}>
              <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={72} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Say hello 👋</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                This is the start of your private space.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={listItems}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              style={styles.flex}
              contentContainerStyle={[styles.list, { paddingTop: listPad, paddingBottom: listPad }]}
              onContentSizeChange={() => scrollToLatest(false)}
              onLayout={() => scrollToLatest(false)}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
            />
          )}

          {/* Typing bubble */}
          {partnerTyping && (
            <View style={styles.typingBubble}>
              <View style={[styles.typingPill, { backgroundColor: colors.chatBubblePartner, borderColor: colors.border }]}>
                <Text style={[styles.typingDots, { color: colors.textSecondary }]}>● ● ●</Text>
              </View>
            </View>
          )}
        </ChatWallpaper>

        {/* ── Recording indicator ── */}
        {isRecording && (
          <View style={[styles.recordingBar, { backgroundColor: colors.error }]}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recording… swipe up to cancel</Text>
            <Pressable onPress={cancelRecording} hitSlop={8}>
              <Icon name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        )}

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

        {/* ── Input bar ── */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingTop: inputBarPad,
              paddingBottom: insets.bottom + inputBarPad,
            },
          ]}>
          {/* + Attachment */}
          <Pressable
            hitSlop={8}
            style={styles.inputSideBtn}
            accessibilityLabel="Add attachment"
            onPress={() => { setShowEmoji(false); setShowAttachment(true); }}>
            <Icon name="plus" size={26} color={colors.textSecondary} />
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
              multiline
              maxLength={2000}
              onFocus={() => {
                setShowEmoji(false);
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

          {/* Camera (always visible) */}
          {!hasText && (
            <Pressable
              hitSlop={8}
              style={styles.inputSideBtn}
              accessibilityLabel="Open camera"
              onPress={handlePickCamera}>
              <Icon name="camera" size={24} color={colors.textSecondary} />
            </Pressable>
          )}

          {/* Send / Mic (hold for voice, tap to send) */}
          <Pressable
            onPress={hasText ? handleSend : undefined}
            onLongPress={!hasText ? startRecording : undefined}
            onPressOut={isRecording ? stopAndSendRecording : undefined}
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

        {/* ── Emoji picker panel ── */}
        {showEmoji && <ChatEmojiPicker onSelect={handleEmojiSelect} />}
      </KeyboardAvoidingView>

      {/* ── Partner info sheet ── */}
      <PartnerInfoSheet
        visible={showPartnerInfo}
        partnerTyping={partnerTyping}
        onClose={() => setShowPartnerInfo(false)}
        onSendMessage={() => { setShowPartnerInfo(false); setTimeout(() => inputRef.current?.focus(), 300); }}
        onViewAvatar={openPartnerAvatar}
      />

      <FullScreenImageModal
        visible={showPartnerAvatar}
        imageUrl={partner?.avatar_url}
        title={partner?.name}
        onClose={() => setShowPartnerAvatar(false)}
      />

      {/* ── Attachment sheet ── */}
      <ChatAttachmentSheet
        visible={showAttachment}
        onClose={() => setShowAttachment(false)}
        onPickGallery={handlePickGallery}
        onPickCamera={handlePickCamera}
        onPickAudio={startRecording}
      />

      {/* ── Long-press action sheet ── */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setSelected(null)}>
          <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <View style={styles.reactionPicker}>
              {REACTION_EMOJI.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => {
                    if (selected && !selected.id.startsWith('temp-')) {
                      react.mutate({ messageId: selected.id, emoji });
                    }
                    setSelected(null);
                  }}
                  style={[styles.reactionBtn, { backgroundColor: colors.surface }]}>
                  <Text style={{ fontSize: 24 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.sheetAction, { borderTopColor: colors.border }]}
              onPress={() => {
                if (selected && !selected.id.startsWith('temp-')) {
                  pin.mutate({ messageId: selected.id, isPinned: !selected.is_pinned });
                }
                setSelected(null);
              }}>
              <Icon name="pin" size={20} color={colors.text} filled={selected?.is_pinned} />
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                {selected?.is_pinned ? 'Unpin' : 'Pin message'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.sheetAction, { borderTopColor: colors.border }]}
              onPress={() => setSelected(null)}>
              <Icon name="close" size={20} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: { flexDirection: 'row', alignItems: 'center' },
  headerSideRight: { justifyContent: 'flex-end' },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 4,
  },
  headerIconSlot: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '700' },
  headerStatus: { fontSize: 12, marginTop: 1 },

  pinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pinnedText: { fontSize: 13, flex: 1 },

  offlineBar: { padding: 8, alignItems: 'center' },
  offlineText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // List
  list: { paddingHorizontal: 2, flexGrow: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginTop: 10 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

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

  // Recording bar
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  recordingText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },

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

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
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

  // Long-press sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  sheet: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 24,
  },
  reactionPicker: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 14,
    flexWrap: 'wrap',
    gap: 8,
  },
  reactionBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
