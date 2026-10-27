import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import type { SendMessageOptions } from '@/services/quotesService';
import type { FollowUpQuestion, QuestionAnswer } from '@/types/copilot';

interface Props {
  questions: FollowUpQuestion[];
  answered?: QuestionAnswer[];
  onSendTurn?: (content: string, options: SendMessageOptions) => void;
}

interface Answer { value: string; label: string; fromOther?: boolean }

/**
 * Grouped clarifier questions. Answers are collected for EVERY question, then sent as one turn
 * (question/answer pairs) so the agent builds the quote in one pass (QuestionsBlock.tsx).
 */
export function QuestionsCard({ questions, answered, onSendTurn }: Props) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState<Record<string, Answer>>({});
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const persisted = useMemo(() => {
    const byId: Record<string, Answer> = {};
    for (const a of answered ?? []) byId[a.questionId] = { value: a.value, label: a.value, fromOther: a.fromOther };
    return byId;
  }, [answered]);

  const isAnswered = Object.keys(persisted).length > 0;
  const answers = isAnswered ? persisted : draft;
  const allAnswered = questions.length > 0 && questions.every((q) => !!answers[q.id]?.value?.trim());
  if (!questions.length) return null;
  const locked = !onSendTurn || isAnswered || submitted;

  const setOptionAnswer = (qid: string, value: string, label: string) => {
    if (locked) return;
    setOtherText((p) => ({ ...p, [qid]: '' }));
    setDraft((p) => ({ ...p, [qid]: { value, label } }));
  };
  const setOtherAnswer = (qid: string, text: string) => {
    if (locked) return;
    setOtherText((p) => ({ ...p, [qid]: text }));
    setDraft((p) => {
      const next = { ...p };
      const t = text.trim();
      if (t) next[qid] = { value: t, label: t, fromOther: true };
      else delete next[qid];
      return next;
    });
  };
  const submit = () => {
    if (!allAnswered || locked || !onSendTurn) return;
    const content =
      questions.length === 1
        ? answers[questions[0].id].value
        : questions.map((q) => `${q.question}\n→ ${answers[q.id].value}`).join('\n\n');
    setSubmitted(true);
    onSendTurn(content, {
      answers: questions.map((q) => ({ questionId: q.id, question: q.question, value: answers[q.id].value, fromOther: answers[q.id].fromOther })),
    });
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
      <View style={styles.titleRow}>
        <Ionicons name="help-circle-outline" size={14} color={colors.textSecondary} />
        <ThemedText type="caption" style={{ fontWeight: '600' }}>A few quick questions</ThemedText>
      </View>
      {questions.map((q) => {
        const answer = answers[q.id];
        const usingOther = !!answer?.fromOther;
        const otherValue = usingOther ? answer.value : otherText[q.id] ?? '';
        return (
          <View key={q.id} style={{ gap: Spacing.sm }}>
            <ThemedText style={{ fontWeight: '500' }}>{q.question}</ThemedText>
            <View style={styles.chips}>
              {q.options.map((opt) => {
                const selected = !usingOther && answer?.value === opt.value;
                return (
                  <Pressable
                    key={opt.id}
                    disabled={locked}
                    onPress={() => setOptionAnswer(q.id, opt.value, opt.label)}
                    style={[
                      styles.chip,
                      { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.background },
                      locked && !selected && { opacity: 0.5 },
                    ]}>
                    {selected && isAnswered && <Ionicons name="checkmark" size={12} color="#fff" />}
                    <ThemedText style={{ fontSize: 12, fontWeight: '500', color: selected ? '#fff' : colors.text }}>{opt.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {q.allowOther && (usingOther || !locked) && (
              <TextInput
                value={otherValue}
                editable={!locked}
                onChangeText={(t) => setOtherAnswer(q.id, t)}
                placeholder="Other…"
                placeholderTextColor={colors.inputPlaceholder}
                style={[
                  styles.other,
                  { borderColor: usingOther ? colors.primary : colors.border, color: usingOther ? colors.primary : colors.text, backgroundColor: colors.background },
                  locked && !usingOther && { opacity: 0.5 },
                ]}
              />
            )}
          </View>
        );
      })}
      {isAnswered ? (
        <View style={styles.titleRow}>
          <Ionicons name="checkmark" size={14} color={colors.primary} />
          <ThemedText type="caption">Answered</ThemedText>
        </View>
      ) : (
        <View style={styles.footer}>
          <ThemedText type="caption" style={{ flex: 1 }}>
            {submitted ? 'Answers sent.' : allAnswered ? 'Ready to build your quote.' : 'Answer all questions to continue.'}
          </ThemedText>
          <Button size="sm" icon="send" disabled={!allAnswered || locked} onPress={submit}>
            {submitted ? 'Sent' : 'Send answers'}
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: BorderRadius.xl, padding: Spacing.md, gap: Spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  other: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
