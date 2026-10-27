import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandingTab } from '@/components/admin/BrandingTab';
import { ConversationsTab } from '@/components/admin/ConversationsTab';
import { LaborTab, PriceMemoryTab, TechniciansTab } from '@/components/admin/PeopleTabs';
import { PricebooksTab } from '@/components/admin/PricebooksTab';
import { PricingTab } from '@/components/admin/PricingTab';
import { ProposalTab } from '@/components/admin/ProposalTab';
import { ThemedText } from '@/components/themed-text';
import { TabBar } from '@/components/ui';
import { Select } from '@/components/ui/Select';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { errMsg, toast } from '@/lib/ui';
import { useLayout } from '@/lib/useLayout';
import { adminService, type AdminCompany } from '@/services/adminService';

const TABS = [
  { key: 'pricebooks', label: 'Pricebooks' }, { key: 'branding', label: 'Branding' }, { key: 'pricing', label: 'Pricing' },
  { key: 'labor', label: 'Labor rates' }, { key: 'memory', label: 'Price memory' }, { key: 'technicians', label: 'Technicians' },
  { key: 'proposal', label: 'Proposal document' }, { key: 'conversations', label: 'Conversations' },
];

/** Internal Clara-team console (web /op-x7k2): hidden, unauthenticated by design, never linked. */
export default function AdminConsole() {
  const { colors } = useTheme();
  const { wide } = useLayout();
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [tab, setTab] = useState('pricebooks');

  useEffect(() => { adminService.listCompanies().then(setCompanies).catch((e) => toast.error(errMsg(e, 'Could not load companies'))); }, []);

  const body = companyId == null ? null
    : tab === 'pricebooks' ? <PricebooksTab companyId={companyId} />
    : tab === 'branding' ? <BrandingTab companyId={companyId} />
    : tab === 'pricing' ? <PricingTab companyId={companyId} />
    : tab === 'labor' ? <LaborTab companyId={companyId} />
    : tab === 'memory' ? <PriceMemoryTab companyId={companyId} />
    : tab === 'technicians' ? <TechniciansTab companyId={companyId} />
    : tab === 'proposal' ? <ProposalTab companyId={companyId} />
    : <ConversationsTab companyId={companyId} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.wrap}>
          <ThemedText type="title" style={{ fontSize: 22 }}>Clara Admin — Company Configuration</ThemedText>
          <Select label="Company" placeholder="Select a company…" value={companyId != null ? String(companyId) : null}
            options={companies.map((c) => ({ value: String(c.id), label: `${c.name} (#${c.id})` }))} onChange={(v) => setCompanyId(Number(v))} />
          {companyId != null && (
            <View style={[{ gap: Spacing.lg }, wide && { flexDirection: 'row', alignItems: 'flex-start' }]}>
              <View style={wide ? { width: 200 } : undefined}>
                {wide ? (
                  <View style={{ gap: 4 }}>
                    {TABS.map((t) => (
                      <ThemedText key={t.key} onPress={() => setTab(t.key)}
                        style={[styles.sideTab, tab === t.key && { backgroundColor: colors.primaryLight, color: colors.primary, fontWeight: '600' }]}>{t.label}</ThemedText>
                    ))}
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}><TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} /></ScrollView>
                )}
              </View>
              <View key={`${companyId}-${tab}`} style={{ flex: 1, gap: Spacing.md }}>{body}</View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },
  wrap: { width: '100%', maxWidth: 1200, alignSelf: 'center', gap: Spacing.lg },
  sideTab: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, fontSize: 15 },
});
