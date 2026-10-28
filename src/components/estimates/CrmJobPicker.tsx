import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Input } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { connectionsService } from '@/services/connectionsService';

/** 'hcp-customer' lists Housecall Pro CUSTOMERS (no job yet) in the same rows. */
export type CrmProvider = 'zt' | 'uptick' | 'servicetrade' | 'hcp' | 'hcp-customer';

const NAME: Record<CrmProvider, string> = {
  zt: 'ZenTrades', uptick: 'Uptick', servicetrade: 'ServiceTrade', hcp: 'Housecall Pro', 'hcp-customer': 'Housecall Pro',
};

/** Picker rows in one shape, whichever CRM they came from (mirrors QuotesList.tsx:56-100). */
interface CrmJob { id: string; ref: string; title: string; subtitle: string; openCount: number }

async function fetchJobs(provider: CrmProvider, q?: string): Promise<CrmJob[]> {
  const date = (iso: string | null) => (iso ? ` · ${new Date(iso).toLocaleDateString()}` : '');
  switch (provider) {
    case 'hcp-customer':
      return (await connectionsService.hcpCustomers(q)).map((c) => ({
        id: c.hcpCustomerId,
        ref: c.name,
        title: c.addressLine ?? c.email ?? '(no address)',
        subtitle: [c.email, c.phone].filter(Boolean).join(' · '),
        openCount: 0,
      }));
    case 'hcp':
      return (await connectionsService.hcpJobs(q)).map((j) => ({
        id: j.hcpJobId,
        ref: j.invoiceNumber ? `#${j.invoiceNumber}` : j.hcpJobId,
        title: j.name || j.description || '(no description)',
        subtitle: [j.customerName, j.addressLine, j.status].filter(Boolean).join(' · ') + date(j.scheduledStart),
        openCount: 0,
      }));
    case 'servicetrade':
      return (await connectionsService.servicetradeJobs(q)).map((j) => ({
        id: j.stJobId,
        ref: j.number ? `#${j.number}` : j.stJobId,
        title: j.name || j.description || '(no description)',
        subtitle: [j.customerName, j.locationName, j.status].filter(Boolean).join(' · '),
        openCount: j.openDeficiencyCount,
      }));
    case 'uptick':
      return (await connectionsService.uptickJobs(q)).map((j) => ({
        id: j.uptickTaskId,
        ref: j.ref ?? j.uptickTaskId,
        title: j.name || j.description || '(no description)',
        subtitle: [j.customerName, j.propertyName, j.status].filter(Boolean).join(' · '),
        openCount: j.openRemarkCount,
      }));
    default:
      return (await connectionsService.ztJobs(q)).map((j) => ({
        id: j.ztTicketId,
        ref: j.ticketNumber ?? j.ztTicketId,
        title: j.jobDescription || '(no description)',
        subtitle: [j.customerName, j.serviceAddressName].filter(Boolean).join(' · ') + date(j.scheduledStartTime),
        openCount: j.openDeficiencyCount,
      }));
  }
}

interface Props {
  provider: CrmProvider | null;
  busy?: boolean;
  onClose: () => void;
  onPick: (provider: CrmProvider, jobId: string) => void;
}

export function CrmJobPicker({ provider, busy, onClose, onPick }: Props) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [jobs, setJobs] = useState<CrmJob[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!provider) { setJobs(null); setSearch(''); return; }
    let live = true;
    setLoading(true);
    const t = setTimeout(() => {
      fetchJobs(provider, search || undefined)
        .then((j) => live && setJobs(j))
        .catch(() => live && setJobs([]))
        .finally(() => live && setLoading(false));
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [provider, search]);

  if (!provider) return null;
  const crm = NAME[provider];
  const isCustomer = provider === 'hcp-customer';
  return (
    <Sheet
      open
      onClose={onClose}
      title={`Choose a${provider === 'uptick' ? 'n' : ''} ${crm} ${isCustomer ? 'customer' : 'job'}`}
      description={`The estimate will start with this ${isCustomer ? "customer's" : "job's"} details filled in.`}>
      <Input
        value={search}
        onChangeText={setSearch}
        placeholder={isCustomer ? 'Search by name, email, phone, or address…' : 'Search by job number, description, or customer…'}
        leftIcon="search"
      />
      {loading && !jobs ? (
        <ActivityIndicator color={colors.tint} style={{ paddingVertical: Spacing['2xl'] }} />
      ) : !jobs?.length ? (
        <ThemedText type="caption" style={{ textAlign: 'center', paddingVertical: Spacing['2xl'] }}>
          No {crm} {isCustomer ? 'customers' : 'jobs'} yet — ask an admin to sync from My Profile.
        </ThemedText>
      ) : (
        jobs.map((job) => (
          <Pressable
            key={job.id}
            disabled={busy}
            onPress={() => onPick(provider, job.id)}
            style={({ pressed }) => [styles.row, { borderColor: colors.borderLight }, pressed && { backgroundColor: colors.backgroundSecondary }]}>
            <View style={{ flex: 1 }}>
              <ThemedText>
                <ThemedText style={{ color: colors.primary }}>{job.ref}</ThemedText> · {job.title}
              </ThemedText>
              <ThemedText type="caption">{job.subtitle}</ThemedText>
            </View>
            {job.openCount > 0 && (
              <Badge size="sm" variant="warning">
                {`${job.openCount} open ${provider === 'uptick' ? 'defect' : 'deficienc'}${job.openCount === 1 ? (provider === 'uptick' ? '' : 'y') : provider === 'uptick' ? 's' : 'ies'}`}
              </Badge>
            )}
          </Pressable>
        ))
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xs, borderBottomWidth: 1, borderRadius: 8 },
});
