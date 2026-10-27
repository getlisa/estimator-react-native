import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { QuestionsCard } from '@/components/estimates/QuestionsCard';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { relativeTime } from '@/lib/ui';
import type { QuoteMessage, SendMessageOptions } from '@/services/quotesService';
import type { QuestionAnswer } from '@/types/copilot';

interface Props {
  message: QuoteMessage;
  /** Answers a later turn gave to this message's clarifying questions. */
  questionAnswers?: QuestionAnswer[];
  /** Absent = interactive blocks are disabled (frozen quote, or a turn in flight). */
  onSendTurn?: (content: string, options: SendMessageOptions) => void;
}

/**
 * One bubble. AI turns with `metadata.blocks` render block-by-block: the estimating agent emits
 * only `markdown` and `questions` (quote.controller.ts:804-822); anything else falls back to
 * markdown of its text, never coerced into another renderer.
 */
export function ChatMessage({ message, questionAnswers, onSendTurn }: Props) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const isAssistant = message.senderType !== 'USER';
  const blocks = (message.metadata as any)?.blocks as { kind: string; [k: string]: any }[] | undefined;
  const hasBlocks = isAssistant && Array.isArray(blocks) && blocks.length > 0;
  const answerChips =
    !isAssistant && Array.isArray((message.metadata as any)?.answers) && (message.metadata as any).answers.length > 0
      ? ((message.metadata as any).answers as string[])
      : null;
  const images = (message.attachments ?? []).filter((a) => (a.type ?? '').startsWith('image/') && a.url);

  if (isAssistant && !message.content && images.length === 0 && !hasBlocks) return null;

  const mdStyle = {
    body: { color: colors.text, fontSize: 15, lineHeight: 22 },
    link: { color: colors.primary },
    code_inline: { backgroundColor: colors.backgroundSecondary, color: colors.text },
    fence: { backgroundColor: colors.backgroundSecondary, color: colors.text },
    bullet_list: { marginVertical: 4 },
  };

  return (
    <View style={[styles.row, !isAssistant && styles.rowUser]}>
      <View style={[styles.avatar, { backgroundColor: isAssistant ? colors.primary : colors.backgroundTertiary }]}>
        <Ionicons name={isAssistant ? 'sparkles' : 'person'} size={16} color={isAssistant ? '#fff' : colors.icon} />
      </View>
      <View style={[styles.body, !isAssistant && { alignItems: 'flex-end' }]}>
        {images.length > 0 && (
          <View style={[styles.images, images.length > 1 && styles.imagesGrid]}>
            {images.map((a) =>
              failed.has(a.id) ? (
                <View key={a.id} style={[styles.imageFallback, { backgroundColor: colors.backgroundSecondary }]}>
                  <Ionicons name="image-outline" size={28} color={colors.textTertiary} />
                  <ThemedText type="caption">Image expired</ThemedText>
                </View>
              ) : (
                <Image
                  key={a.id}
                  source={{ uri: a.url }}
                  style={[styles.image, images.length > 1 && styles.imageHalf]}
                  onError={() => setFailed((p) => new Set(p).add(a.id))}
                />
              )
            )}
          </View>
        )}
        {hasBlocks ? (
          <View style={{ gap: Spacing.sm, alignSelf: 'stretch' }}>
            {blocks!.map((b, i) =>
              b.kind === 'questions' ? (
                <QuestionsCard key={i} questions={b.data?.questions ?? []} answered={questionAnswers} onSendTurn={onSendTurn} />
              ) : (
                <View key={i} style={[styles.bubble, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                  <Markdown style={mdStyle}>{b.kind === 'markdown' ? String(b.text ?? '') : String(b.text ?? JSON.stringify(b))}</Markdown>
                </View>
              )
            )}
          </View>
        ) : answerChips ? (
          <View style={styles.chips}>
            {answerChips.map((a, i) => (
              <View key={i} style={[styles.chip, { backgroundColor: colors.primary }]}>
                <ThemedText style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{a}</ThemedText>
              </View>
            ))}
          </View>
        ) : message.content ? (
          isAssistant ? (
            <View style={[styles.bubble, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
              <Markdown style={mdStyle}>{message.content}</Markdown>
            </View>
          ) : (
            <View style={[styles.bubble, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              <ThemedText style={{ color: '#fff' }}>{message.content}</ThemedText>
            </View>
          )
        ) : null}
        <ThemedText type="caption" style={{ fontSize: 11 }}>{relativeTime(message.createdAt)}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  rowUser: { flexDirection: 'row-reverse' },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, maxWidth: '85%', gap: Spacing.xs },
  bubble: { borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderWidth: 1 },
  images: { gap: Spacing.sm, alignSelf: 'stretch' },
  imagesGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12 },
  imageHalf: { width: '48%' },
  imageFallback: { minHeight: 100, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, width: '100%' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
});
