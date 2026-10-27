import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ChatTab } from '@/components/estimates/ChatTab';
import { DeliveryMenu } from '@/components/estimates/DeliveryMenu';
import { EstimateTab } from '@/components/estimates/EstimateTab';
import { ThemedText } from '@/components/themed-text';
import { Badge, TabBar } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from '@/lib/ui';
import { useLayout } from '@/lib/useLayout';
import { quotesService, quoteTitle, type Quote, type QuoteMessage, type SendMessageOptions } from '@/services/quotesService';

interface Props {
  id: string;
  onClose: () => void;
  /** Wide layout: tell the list to refresh after a status change. */
  onChanged?: () => void;
}

/** One chat = one quote (PRD US1/US8). Chat and Estimate tabs; Send/Download in any state (US7). */
export function QuoteDetailView({ id, onClose, onChanged }: Props) {
  const { colors } = useTheme();
  const { split } = useLayout();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [messages, setMessages] = useState<QuoteMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<'chat' | 'estimate'>('chat');

  useEffect(() => {
    setLoading(true);
    quotesService
      .get(id)
      .then(({ messages: msgs, ...q }) => { setQuote(q); setMessages(msgs); })
      .catch((e: Error) => { toast.error(e.message); onClose(); })
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onQuoteChange = useCallback((q: Quote) => {
    setQuote((prev) => { if (prev && prev.status !== q.status) onChanged?.(); return q; });
  }, [onChanged]);

  const handleSend = useCallback(async (content: string, options?: SendMessageOptions) => {
    if (!quote || sending) return;
    setSending(true);
    const localId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: localId,
        senderType: 'USER',
        content,
        createdAt: new Date().toISOString(),
        metadata:
          options?.answers?.length && options.answeredMessageId
            ? { answers: options.answers.map((a) => a.value), questionAnswers: options.answers, answeredMessageId: options.answeredMessageId }
            : undefined,
      },
    ]);
    try {
      const { reply, quote: updated } = await quotesService.sendMessage(id, content, options);
      setMessages((prev) => [...prev, reply]);
      onQuoteChange(updated);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== localId));
      toast.error(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }, [id, quote, sending, onQuoteChange]);

  if (loading || !quote) {
    return <View style={styles.center}><ActivityIndicator color={colors.tint} /></View>;
  }

  const chat = (
    <ChatTab
      quoteId={quote.id}
      messages={messages}
      disabled={quote.status === 'COMPLETED'}
      sending={sending}
      onSend={handleSend}
      onLocalMessage={(m) => setMessages((prev) => [...prev, m])}
    />
  );
  const estimate = <EstimateTab quote={quote} onQuoteChange={onQuoteChange} />;

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={24} color={colors.icon} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <ThemedText type="defaultSemiBold" numberOfLines={1}>{quoteTitle(quote)}</ThemedText>
            <Badge size="sm" variant={quote.status === 'COMPLETED' ? 'primary' : 'default'}>
              {quote.status === 'COMPLETED' ? 'Completed' : 'Draft'}
            </Badge>
          </View>
          <DeliveryMenu quote={quote} onQuoteChange={onQuoteChange} />
        </View>
        {!split && (
          <TabBar
            tabs={[
              { key: 'chat', label: 'Chat' },
              { key: 'estimate', label: 'Estimate', badge: quote.blockingFlagCount > 0 ? quote.blockingFlagCount : undefined },
            ]}
            activeTab={tab}
            onTabChange={(k) => setTab(k as typeof tab)}
          />
        )}
      </View>
      {split ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: colors.border }}>{chat}</View>
          <View style={{ flex: 1 }}>{estimate}</View>
        </View>
      ) : tab === 'chat' ? chat : estimate}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { borderBottomWidth: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.sm, gap: Spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
