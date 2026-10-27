import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { ChatMessage } from '@/components/estimates/ChatMessage';
import { Composer } from '@/components/estimates/Composer';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import type { PickedFile } from '@/lib/upload';
import { toast } from '@/lib/ui';
import { quotesService, type QuoteMessage, type SendMessageOptions } from '@/services/quotesService';
import type { QuestionAnswer } from '@/types/copilot';

interface Props {
  quoteId: string;
  messages: QuoteMessage[];
  disabled: boolean; // Completed quotes are frozen
  sending: boolean;
  onSend: (content: string, options?: SendMessageOptions) => void;
  onLocalMessage: (message: QuoteMessage) => void;
}

interface AnswerMetadata {
  answers?: unknown;
  questionAnswers?: QuestionAnswer[];
  answeredMessageId?: string;
}

function cardAnswers(meta: AnswerMetadata | null | undefined): QuestionAnswer[] {
  const given = meta?.questionAnswers;
  if (!Array.isArray(given)) return [];
  return given.filter((a) => a && typeof a.questionId === 'string' && !!a.value);
}

/** Answers a turn submitted against an earlier question card, keyed by that card's message id. */
function answersByQuestionCard(messages: QuoteMessage[]): Map<string, QuestionAnswer[]> {
  const byCard = new Map<string, QuestionAnswer[]>();
  for (const m of messages) {
    const meta = m.metadata as AnswerMetadata | null | undefined;
    const answers = cardAnswers(meta);
    if (answers.length > 0 && meta?.answeredMessageId) byCard.set(meta.answeredMessageId, answers);
  }
  return byCard;
}

/** A turn that only submits question-card answers — the card shows them, so it isn't rendered. */
function isAnswerEcho(m: QuoteMessage): boolean {
  const meta = m.metadata as AnswerMetadata | null | undefined;
  return m.senderType === 'USER' && cardAnswers(meta).length > 0 && !!meta?.answeredMessageId;
}

export function ChatTab({ quoteId, messages, disabled, sending, onSend, onLocalMessage }: Props) {
  const { colors } = useTheme();
  const listRef = useRef<FlatList<QuoteMessage>>(null);
  const [attaching, setAttaching] = useState(false);
  const answers = useMemo(() => answersByQuestionCard(messages), [messages]);
  const visible = useMemo(() => messages.filter((m) => !isAnswerEcho(m)), [messages]);

  /** Camera/gallery photos attach to the QUOTE itself (PRD US6) — never routed to the agent. */
  const attachToQuote = async (files: PickedFile[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    setAttaching(true);
    try {
      const attached = await quotesService.uploadImages(quoteId, images);
      onLocalMessage({
        id: `local-attach-${Date.now()}`,
        senderType: 'USER',
        content: images.length === 1 ? 'Photo attached to the quote' : `${images.length} photos attached to the quote`,
        contentType: 'IMAGE',
        attachments: images.map((f, i) => ({ id: `${Date.now()}-${i}`, url: f.uri, type: f.type || 'image/jpeg', filename: f.name })),
        createdAt: new Date().toISOString(),
      });
      toast.success(`Photo attached to the quote (${attached.length} total) — see the Estimate tab`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not attach the photo');
    } finally {
      setAttaching(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length, sending]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={visible}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <ThemedText type="caption" style={{ textAlign: 'center' }}>No messages yet — speak or type to start capturing this job.</ThemedText>
          </View>
        }
        renderItem={({ item: m }) => (
          <ChatMessage
            message={m}
            questionAnswers={answers.get(m.id)}
            onSendTurn={disabled || sending ? undefined : (content, options) => onSend(content, { ...options, answeredMessageId: m.id })}
          />
        )}
        ListFooterComponent={
          sending ? (
            <View style={styles.sending}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <ThemedText type="caption">Updating the estimate…</ThemedText>
            </View>
          ) : null
        }
      />
      <View style={[styles.composer, { borderTopColor: colors.border }]}>
        {disabled ? (
          <ThemedText type="caption" style={{ textAlign: 'center', paddingVertical: Spacing.sm }}>
            This estimate is Completed and frozen — move it back to Draft to edit.
          </ThemedText>
        ) : (
          <Composer
            onSend={(content) => onSend(content)}
            onPhotos={attachToQuote}
            busy={sending || attaching}
            placeholder="Describe the job or add items…"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.lg, gap: Spacing.lg, flexGrow: 1 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: Spacing['2xl'] },
  sending: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  composer: { borderTopWidth: 1, padding: Spacing.md },
});
