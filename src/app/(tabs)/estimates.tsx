import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CrmJobPicker, type CrmProvider } from '@/components/estimates/CrmJobPicker';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, TabBar } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { relativeTime, toast } from '@/lib/ui';
import { useLayout } from '@/lib/useLayout';
import { connectionsService, type ConnectionsStatus } from '@/services/connectionsService';
import { quotesService, quoteTitle, type Quote } from '@/services/quotesService';

const CRM_LABEL: Record<CrmProvider, string> = { zt: 'ZenTrades', uptick: 'Uptick', servicetrade: 'ServiceTrade', hcp: 'Housecall Pro' };

/** Chat list — one chat = one quote. Draft list by default (PRD US1/US9). */
export default function EstimatesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { wide, scale } = useLayout();
  const [tab, setTab] = useState<'DRAFT' | 'COMPLETED'>('DRAFT');
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [chooser, setChooser] = useState(false);
  const [picker, setPicker] = useState<CrmProvider | null>(null);
  const [connections, setConnections] = useState<ConnectionsStatus | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setQuotes(await quotesService.list(tab));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load estimates');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useFocusEffect(useCallback(() => { load(quotes !== null); }, [load])); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { connectionsService.get().then(setConnections).catch(() => undefined); }, []);

  const crms = (['zt', 'uptick', 'servicetrade', 'hcp'] as CrmProvider[]).filter((p) => connections?.[p]?.connected === true);

  // Every width opens the quote on its own screen; wide screens show chat and estimate side by side there.
  const open = (id: string) => router.push(`/estimates/${id}`);

  const create = async (seed?: Parameters<typeof quotesService.create>[0]) => {
    setCreating(true);
    try {
      const q = await quotesService.create(seed);
      setChooser(false);
      if (tab === 'DRAFT') setQuotes((prev) => [q, ...(prev ?? [])]);
      open(q.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create estimate');
    } finally {
      setCreating(false);
    }
  };

  const moveToDraft = async (id: string) => {
    try {
      await quotesService.reopen(id);
      toast.success('Moved back to Draft — line items are editable again');
      load(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not reopen');
    }
  };

  const list = (
    <View style={[styles.listPane, wide && styles.listWide]}>
      <View style={styles.header}>
        <ThemedText type="title" style={{ fontSize: 24 * scale }}>Estimates</ThemedText>
        <Button
          size="sm"
          icon="add"
          loading={creating}
          onPress={() => (crms.length ? setChooser(true) : create())}>
          New Chat
        </Button>
      </View>
      <TabBar
        tabs={[{ key: 'DRAFT', label: 'Draft' }, { key: 'COMPLETED', label: 'Completed' }]}
        activeTab={tab}
        onTabChange={(k) => { setTab(k as typeof tab); setQuotes(null); }}
      />
      {loading && quotes === null ? (
        <ActivityIndicator style={{ marginTop: Spacing['2xl'] }} color={colors.tint} />
      ) : (
        <FlatList
          data={quotes ?? []}
          keyExtractor={(q) => q.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading && quotes !== null} onRefresh={() => load(true)} tintColor={colors.tint} />}
          ListEmptyComponent={
            <View style={[styles.empty, { borderColor: colors.border }]}>
              <ThemedText type="caption" style={{ textAlign: 'center' }}>
                {tab === 'DRAFT' ? 'No draft quotes yet — start a new chat to capture a job.' : 'No completed quotes yet.'}
              </ThemedText>
            </View>
          }
          renderItem={({ item: q }) => (
            <Pressable
              onPress={() => open(q.id)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: colors.border, backgroundColor: colors.cardBackground },
                pressed && { backgroundColor: colors.cardPressed },
              ]}>
              <View style={styles.rowTop}>
                <ThemedText type="defaultSemiBold" style={{ flex: 1 }} numberOfLines={2}>{quoteTitle(q)}</ThemedText>
                <View style={styles.badges}>
                  {q.ztTicketId && <Badge size="sm">{`ZT ${q.ztTicketId}${q.customerName ? ` · ${q.customerName}` : ''}`}</Badge>}
                  {q.uptickTaskId && <Badge size="sm">{`Uptick ${q.uptickTaskId}${q.customerName ? ` · ${q.customerName}` : ''}`}</Badge>}
                  {q.stJobId && <Badge size="sm">{`ServiceTrade ${q.stJobId}${q.customerName ? ` · ${q.customerName}` : ''}`}</Badge>}
                  {q.hcpJobId && <Badge size="sm">{`Housecall Pro${q.customerName ? ` · ${q.customerName}` : ''}`}</Badge>}
                  <Badge size="sm" variant={q.status === 'COMPLETED' ? 'primary' : 'default'}>
                    {q.status === 'COMPLETED' ? 'Completed' : 'Draft'}
                  </Badge>
                </View>
              </View>
              <ThemedText type="caption">
                Last updated {relativeTime(q.updatedAt)}
                {q.status === 'DRAFT' && q.blockingFlagCount > 0 && (
                  <ThemedText type="caption" style={{ color: colors.warning }}> · {q.blockingFlagCount} item(s) need attention</ThemedText>
                )}
              </ThemedText>
              {q.status === 'COMPLETED' && (
                <View style={{ marginTop: Spacing.sm, alignSelf: 'flex-start' }}>
                  <Button size="sm" variant="secondary" onPress={() => moveToDraft(q.id)}>Move back to Draft</Button>
                </View>
              )}
            </Pressable>
          )}
        />
      )}

      <Sheet open={chooser} onClose={() => setChooser(false)} title="New Chat">
        <MenuItem icon="chatbubble-outline" title="Blank estimate" subtitle="Start from an empty chat" onPress={() => create()} />
        {crms.map((p) => (
          <MenuItem
            key={p}
            icon="construct-outline"
            title={`From ${CRM_LABEL[p]} job`}
            subtitle={p === 'uptick' ? 'Pick a synced task — chat starts pre-filled' : 'Pick a synced job — chat starts pre-filled'}
            onPress={() => { setChooser(false); setPicker(p); }}
          />
        ))}
      </Sheet>
      <CrmJobPicker
        provider={picker}
        onClose={() => setPicker(null)}
        busy={creating}
        onPick={(provider, id) => {
          setPicker(null);
          create(
            provider === 'uptick' ? { uptickTaskId: id }
            : provider === 'servicetrade' ? { stJobId: id }
            : provider === 'hcp' ? { hcpJobId: id }
            : { ztTicketId: id }
          );
        }}
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.body}>{list}</View>
    </SafeAreaView>
  );
}

function MenuItem({ icon, title, subtitle, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.backgroundSecondary }]}>
      <Ionicons name={icon} size={20} color={colors.icon} />
      <View style={{ flex: 1 }}>
        <ThemedText>{title}</ThemedText>
        <ThemedText type="caption">{subtitle}</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  listPane: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.md },
  listWide: { width: '100%', maxWidth: 900, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listContent: { gap: Spacing.sm, paddingBottom: Spacing['3xl'] },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: Spacing['2xl'] },
  row: { borderWidth: 1, borderRadius: 12, padding: Spacing.lg, gap: Spacing.xs },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, justifyContent: 'flex-end', maxWidth: '55%' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderRadius: 10 },
});
