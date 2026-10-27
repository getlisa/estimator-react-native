import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, CardBody, Input } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { isAdminRole } from '@/lib/roles';
import { errMsg, fmtDateTime, toast } from '@/lib/ui';
import { connectionsService, type ConnectionsStatus, type SyncProvider } from '@/services/connectionsService';

/**
 * Connections (QBO PRD US1): every user sees status; admins connect/sync/disconnect (server
 * enforces 403 too). Refreshes when the app returns to the foreground — that is also how the
 * QuickBooks OAuth result arrives, since the server redirects to the web app, not here.
 */
export function ConnectionsCard() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [status, setStatus] = useState<ConnectionsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const canManage = status?.canManage ?? isAdminRole(user?.role);

  const refresh = useCallback(async () => {
    try {
      const next = await connectionsService.get();
      setStatus(next);
      setLastSyncedAt((prev) => {
        const fromServer = next.qbo.referenceSyncedAt ?? null;
        if (!prev) return fromServer;
        if (!fromServer) return prev;
        return new Date(fromServer) > new Date(prev) ? fromServer : prev;
      });
    } catch { /* keep last known */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);

  const openConsent = async () => {
    setBusy(true);
    try {
      const { authUrl } = await connectionsService.startQboConnect();
      if (Platform.OS === 'web') window.open(authUrl, '_blank', 'noopener');
      else await WebBrowser.openBrowserAsync(authUrl);
      toast.info('Finish signing in on the QuickBooks page — this screen updates when you come back.');
      refresh();
    } catch (e) { toast.error('Could not start the QuickBooks sign-in', errMsg(e)); } finally { setBusy(false); }
  };
  const sync = async () => {
    setSyncing(true);
    try {
      const { counts, syncedAt } = await connectionsService.syncQbo();
      setLastSyncedAt(syncedAt);
      toast.success(`QuickBooks synced — ${counts.customers} customers · ${counts.items} items · ${counts.taxRates} tax rates`);
    } catch (e) { toast.error('Could not sync QuickBooks', errMsg(e)); } finally { setSyncing(false); }
  };
  const disconnect = async () => {
    setBusy(true);
    try {
      setStatus(await connectionsService.disconnectQbo());
      toast.success('QuickBooks disconnected — completed quotes will stop posting until you connect again.');
    } catch (e) { toast.error('Could not disconnect QuickBooks', errMsg(e)); } finally { setBusy(false); }
  };

  const qbo = status?.qbo;
  const qboLine = !qbo ? 'Status unavailable right now.' : qbo.connected ? '' : qbo.reconnectRequired
    ? 'This connection has expired — sign in again to resume posting estimates.'
    : qbo.configured ? 'Post completed quotes into your QuickBooks as estimates.' : 'Not configured on the server yet — contact your Clara team.';

  return (
    <Card variant="elevated">
      <CardBody>
        <ThemedText type="subtitle" style={{ fontSize: 18 }}>Connections</ThemedText>
        <ThemedText type="caption" style={{ marginBottom: Spacing.md }}>
          Link third-party platforms. QuickBooks signs in on its own page; ZenTrades, Uptick and ServiceTrade connect with the company's own login, Housecall Pro with its API key — all stored encrypted.
        </ThemedText>
        {loading ? <ActivityIndicator color={colors.tint} style={{ padding: Spacing.xl }} /> : (
          <View>
            <View style={[styles.rowBlock, { borderTopColor: colors.borderLight }]}>
              <View style={styles.titleRow}>
                <View style={styles.titleLeft}>
                  <ThemedText type="defaultSemiBold">QuickBooks Online</ThemedText>
                  {qbo?.connected && <Badge size="sm" variant="success">Connected</Badge>}
                  {qbo?.reconnectRequired && <Badge size="sm" variant="warning">Sign in again</Badge>}
                </View>
                {canManage && (
                  <View style={styles.actions}>
                    {qbo?.connected ? (
                      <>
                        <Button size="sm" icon="refresh-outline" loading={syncing} disabled={busy} onPress={sync}>Sync</Button>
                        <Button size="sm" variant="secondary" icon="unlink-outline" loading={busy} disabled={syncing} onPress={disconnect}>Disconnect</Button>
                      </>
                    ) : (
                      <Button size="sm" icon="open-outline" loading={busy} disabled={!qbo?.configured} onPress={openConsent}>Connect</Button>
                    )}
                  </View>
                )}
              </View>
              {!!qboLine && <ThemedText type="caption">{qboLine}</ThemedText>}
              {lastSyncedAt && <ThemedText type="caption">Synced {fmtDateTime(lastSyncedAt)}</ThemedText>}
              {!canManage && qbo?.configured && !qbo?.connected && <ThemedText type="caption">Only a company admin can connect QuickBooks.</ThemedText>}
            </View>
            {CRMS.map((c) => <CrmRow key={c.provider} cfg={c} status={status} canManage={canManage} onChanged={refresh} />)}
          </View>
        )}
      </CardBody>
    </Card>
  );
}

// ---- CRM rows: one component, four configs (ZtRow / UptickRow / ServicetradeRow / HcpRow) ----
interface CrmCfg {
  provider: SyncProvider;
  name: string;
  pitch: string;
  fields: { key: string; placeholder: string; secret?: boolean }[];
  helper?: string;
  connectedWith: (s: ConnectionsStatus) => string | null;
  connect: (form: Record<string, string>) => Promise<unknown>;
  connectedMsg: string;
  sync: () => Promise<{ errors: string[] } & Record<string, unknown>>;
  summary: (r: any) => string;
  disconnect: () => Promise<unknown>;
}

const CRMS: CrmCfg[] = [
  {
    provider: 'zt', name: 'ZenTrades', pitch: 'Bring in jobs and deficiencies, and post completed estimates back.',
    fields: [{ key: 'username', placeholder: 'ZenTrades email' }, { key: 'password', placeholder: 'ZenTrades password', secret: true }],
    connectedWith: (s) => s.zt.ztCompanyName, connect: (f) => connectionsService.connectZt(f.username.trim(), f.password),
    connectedMsg: 'ZenTrades connected — jobs and deficiencies will be available once syncing ships.',
    sync: () => connectionsService.syncZt(), summary: (r) => `${r.jobs} jobs, ${r.deficiencies} deficiencies, ${r.catalog} price items, ${r.tax} tax rates updated.`,
    disconnect: () => connectionsService.disconnectZt(),
  },
  {
    provider: 'uptick', name: 'Uptick', pitch: 'Bring in jobs, defects and the product list; post completed estimates back as defect quotes.',
    fields: [
      { key: 'baseUrl', placeholder: 'Workspace URL (yourcompany.onuptick.com)' }, { key: 'clientId', placeholder: 'Client ID (Control Panel › Uptick API)' },
      { key: 'clientSecret', placeholder: 'Client secret', secret: true }, { key: 'username', placeholder: 'Uptick user email' }, { key: 'password', placeholder: 'Uptick password', secret: true },
    ],
    connectedWith: (s) => s.uptick.baseUrl?.replace(/^https?:\/\//, '') ?? null,
    connect: (f) => connectionsService.connectUptick({ baseUrl: f.baseUrl.trim(), clientId: f.clientId, clientSecret: f.clientSecret, username: f.username, password: f.password }),
    connectedMsg: 'Uptick connected — sync now to bring in jobs and defects.',
    sync: () => connectionsService.syncUptick(), summary: (r) => `${r.tasks} jobs, ${r.remarks} defects, ${r.products} products updated.`,
    disconnect: () => connectionsService.disconnectUptick(),
  },
  {
    provider: 'servicetrade', name: 'ServiceTrade', pitch: 'Bring in jobs, deficiencies, the item library and tax groups; post completed estimates back as quotes.',
    fields: [{ key: 'username', placeholder: 'ServiceTrade username' }, { key: 'password', placeholder: 'ServiceTrade password', secret: true }],
    connectedWith: (s) => s.servicetrade.stCompanyName, connect: (f) => connectionsService.connectServicetrade(f.username.trim(), f.password),
    connectedMsg: 'ServiceTrade connected — sync now to bring in jobs and deficiencies.',
    sync: () => connectionsService.syncServicetrade(), summary: (r) => `${r.jobs} jobs, ${r.deficiencies} deficiencies, ${r.items} items, ${r.tax} tax groups updated.`,
    disconnect: () => connectionsService.disconnectServicetrade(),
  },
  {
    provider: 'hcp', name: 'Housecall Pro', pitch: 'Bring in jobs and the price book; post completed estimates to its Estimates tab.',
    fields: [{ key: 'apiKey', placeholder: 'Housecall Pro API key', secret: true }],
    helper: 'Generate it in Housecall Pro under App Store › API (MAX plan). The key is stored encrypted.',
    connectedWith: (s) => s.hcp.hcpCompanyName, connect: (f) => connectionsService.connectHcp(f.apiKey.trim()),
    connectedMsg: 'Housecall Pro connected — sync now to bring in jobs and the price book.',
    sync: () => connectionsService.syncHcp(), summary: (r) => `${r.jobs} jobs, ${r.items} price book items updated.`,
    disconnect: () => connectionsService.disconnectHcp(),
  },
];

/** Live sync caption + "already running" adoption (ConnectionsCard.tsx useSyncWatch). */
function useSyncWatch(provider: SyncProvider, name: string, syncRunning: boolean, onChanged: () => Promise<void> | void) {
  const [syncingNow, setSyncingNow] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const watchOnly = useRef(false);
  const sawProgress = useRef(false);

  useEffect(() => {
    if (!syncRunning || syncingNow) return;
    let cancelled = false;
    connectionsService.syncProgress(provider).then((p) => {
      if (cancelled || p.progress === null) return;
      watchOnly.current = true; sawProgress.current = true;
      setProgress(p.progress); setSyncingNow(true);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [syncRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!syncingNow) { setProgress(null); return; }
    const timer = setInterval(() => {
      connectionsService.syncProgress(provider).then((p) => {
        setProgress(p.progress);
        if (p.progress !== null) sawProgress.current = true;
        if (watchOnly.current && p.progress === null) {
          watchOnly.current = false;
          setSyncingNow(false);
          if (sawProgress.current) { toast.success(`${name} sync finished`); void onChanged(); }
          else toast.info('No sync is actually running — the previous run was interrupted; its lock frees after 10 minutes, try again then.');
        }
      }).catch(() => undefined);
    }, 1500);
    return () => clearInterval(timer);
  }, [syncingNow]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setSyncingNow(true);
    try { return await fn(); }
    catch (e) {
      if (e instanceof Error && /already running/i.test(e.message)) {
        watchOnly.current = true; sawProgress.current = false;
        toast.info(`A sync is already running — showing its progress. ${e.message}`);
        return null;
      }
      throw e;
    } finally { if (!watchOnly.current) setSyncingNow(false); }
  };
  return { syncingNow, progress, run };
}

function CrmRow({ cfg, status, canManage, onChanged }: { cfg: CrmCfg; status: ConnectionsStatus | null; canManage: boolean; onChanged: () => Promise<void> }) {
  const { colors } = useTheme();
  const row = status?.[cfg.provider] ?? null;
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const watch = useSyncWatch(cfg.provider, cfg.name, row?.syncRunning === true, onChanged);
  const complete = cfg.fields.every((f) => (form[f.key] ?? '').trim());
  const line = !row ? 'Status unavailable right now.' : row.connected ? '' : row.configured ? cfg.pitch : 'Not configured on the server yet — contact your Clara team.';

  const connect = async () => {
    setBusy(true);
    try { await cfg.connect(form); setFormOpen(false); setForm({}); await onChanged(); toast.success(cfg.connectedMsg); }
    catch (e) { toast.error(`Could not connect ${cfg.name}`, errMsg(e)); } finally { setBusy(false); }
  };
  const sync = async () => {
    try {
      const r = await watch.run(cfg.sync);
      if (!r) return;
      await onChanged();
      if (r.errors.length > 0) toast.error(`${cfg.name} sync finished with problems`, r.errors.join(' · '));
      else toast.success(`${cfg.name} synced — ${cfg.summary(r)}`);
    } catch (e) { toast.error(`${cfg.name} sync failed`, errMsg(e)); }
  };
  const disconnect = async () => {
    setBusy(true);
    try { await cfg.disconnect(); await onChanged(); toast.success(`${cfg.name} disconnected`); }
    catch (e) { toast.error(`Could not disconnect ${cfg.name}`, errMsg(e)); } finally { setBusy(false); }
  };
  const connectedWith = status ? cfg.connectedWith(status) : null;

  return (
    <View style={[styles.rowBlock, { borderTopColor: colors.borderLight }]}>
      <View style={styles.titleRow}>
        <View style={styles.titleLeft}>
          <ThemedText type="defaultSemiBold">{cfg.name}</ThemedText>
          {row?.connected && <Badge size="sm" variant="success">{connectedWith ? `Connected — ${connectedWith}` : 'Connected'}</Badge>}
        </View>
        {canManage && !row?.connected && !formOpen && (
          <Button size="sm" disabled={busy || !row?.configured} onPress={() => setFormOpen(true)}>Connect</Button>
        )}
        {canManage && row?.connected && (
          <View style={styles.actions}>
            <Button size="sm" icon="refresh-outline" loading={watch.syncingNow} disabled={busy} onPress={sync}>{watch.syncingNow ? 'Syncing…' : 'Sync now'}</Button>
            <Button size="sm" variant="secondary" icon="unlink-outline" disabled={busy || watch.syncingNow} onPress={disconnect}>Disconnect</Button>
          </View>
        )}
      </View>
      {!!line && <ThemedText type="caption">{line}</ThemedText>}
      {!canManage && row?.configured && !row?.connected && <ThemedText type="caption">Only a company admin can connect {cfg.name}.</ThemedText>}
      {canManage && formOpen && !row?.connected && (
        <View style={{ gap: Spacing.sm }}>
          {cfg.fields.map((f) => (
            <Input key={f.key} value={form[f.key] ?? ''} onChangeText={(v) => setForm({ ...form, [f.key]: v })} placeholder={f.placeholder}
              credentialType={f.secret ? 'newPassword' : 'none'} autoCapitalize="none" />
          ))}
          {cfg.helper && <ThemedText type="caption">{cfg.helper}</ThemedText>}
          <View style={styles.actions}>
            <Button size="sm" loading={busy} disabled={!complete} onPress={connect}>Connect</Button>
            <Button size="sm" variant="ghost" disabled={busy} onPress={() => setFormOpen(false)}>Cancel</Button>
          </View>
        </View>
      )}
      {watch.syncingNow && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
          <ThemedText type="caption" style={{ flex: 1 }}>{watch.progress ?? `Syncing with ${cfg.name} — a first sync can take a few minutes…`}</ThemedText>
        </View>
      )}
      {canManage && row?.connected && (
        <ThemedText type="caption">
          {row.lastSyncError ? `Last sync had problems: ${row.lastSyncError}` : row.lastSyncAt ? `Last synced ${fmtDateTime(row.lastSyncAt)}` : 'Never synced'}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rowBlock: { borderTopWidth: 1, paddingVertical: Spacing.md, gap: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap', gap: Spacing.sm },
  titleLeft: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, flexShrink: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
