import { buildHeaders } from "@/services/copilotChatService";
// Same reason every other copilot-server call uses it: these requests bypass the axios
// interceptor, so an expired access token would fail them until the user logged out and in.
import { authFetch } from "@/services/authFetch";

/**
 * Company-level integration connections (copilot-server, not the main API).
 *
 * Clara owns the QuickBooks app, so connecting is one click: an admin asks the server for a
 * consent URL and approves on Intuit's page. Nothing about QuickBooks — password or app keys —
 * is ever typed into CLARA.
 *
 * Status is readable by every user; connect and disconnect are admin-only and 403 otherwise.
 */

const API_BASE = `${process.env.EXPO_PUBLIC_COPILOT_BASE_URL}/api/v1/companies`;

export interface QboConnectionStatus {
  /** Server has the QuickBooks app keys and callback configured; false disables the whole row. */
  configured: boolean;
  /** OAuth consent completed against the keyset this server runs. */
  connected: boolean;
  /**
   * Tokens exist but were issued by the OTHER Intuit keyset (sandbox vs production), so they no
   * longer work — the company must reconnect. Shown as "Reconnect", never as "Connected".
   */
  reconnectRequired: boolean;
  realmId: string | null;
  /** Which Intuit environment the SERVER runs against — not a per-company choice. */
  environment: "production" | "sandbox";
  /**
   * When reference data (customers, items, accounts, tax) last COMPLETED a full sync — every
   * stage succeeding. Null when it never has. The server has always returned this; the
   * Connections card was holding a session-only value instead, so a reload lost it and staleness
   * from a previous session was invisible.
   */
  referenceSyncedAt?: string | null;
}

export interface ZtConnectionStatus {
  /** Server has ZT_TOKEN_KEY set; false disables the whole row. */
  configured: boolean;
  connected: boolean;
  /** The ZenTrades company id the stored login belongs to. */
  ztCompanyId: string | null;
  /** The ZenTrades company NAME — which account is bound, not just that one is. */
  ztCompanyName: string | null;
  /** Last COMPLETE sync (every stage succeeded); null = never synced. */
  lastSyncAt: string | null;
  lastSyncError: string | null;
  /** A sync claim is held server-side (live run OR an orphaned lock from an interrupted one). */
  syncRunning: boolean;
}

/** One synced ZenTrades job, as the Estimates-tab picker shows it. */
export interface ZtJob {
  ztTicketId: string;
  ticketNumber: string | null;
  jobDescription: string;
  jobStatus: string | null;
  customerName: string | null;
  serviceAddressName: string | null;
  scheduledStartTime: string | null;
  openDeficiencyCount: number;
  ztUpdatedAt: string | null;
}

export interface UptickConnectionStatus {
  configured: boolean;
  connected: boolean;
  /** The bound workspace, https://<tenant>.onuptick.com. */
  baseUrl: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  syncRunning: boolean;
}

/** One synced Uptick task (job), as the picker shows it. */
export interface UptickJob {
  uptickTaskId: string;
  ref: string | null;
  name: string;
  description: string;
  status: string | null;
  customerName: string | null;
  propertyName: string | null;
  openRemarkCount: number;
  uptickUpdatedAt: string | null;
}

export interface ServicetradeConnectionStatus {
  /** Server has a sealing key; false disables the whole row. */
  configured: boolean;
  connected: boolean;
  /** The ServiceTrade company (vendor) NAME the stored login belongs to. */
  stCompanyName: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  syncRunning: boolean;
}

/** One synced ServiceTrade job, as the picker shows it. */
export interface ServicetradeJob {
  stJobId: string;
  number: string | null;
  name: string;
  description: string;
  status: string | null;
  customerName: string | null;
  locationName: string | null;
  openDeficiencyCount: number;
  stUpdatedAt: string | null;
}

export interface HcpConnectionStatus {
  /** Server has a sealing key; false disables the whole row. */
  configured: boolean;
  connected: boolean;
  /** The Housecall Pro company NAME the stored API key belongs to. */
  hcpCompanyName: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  syncRunning: boolean;
}

/** One synced Housecall Pro job, as the picker shows it. */
export interface HcpJob {
  hcpJobId: string;
  invoiceNumber: string | null;
  name: string;
  description: string;
  status: string | null;
  customerName: string | null;
  addressLine: string | null;
  scheduledStart: string | null;
  hcpUpdatedAt: string | null;
}

/** One synced Housecall Pro customer, as the "from a customer" picker shows it. */
export interface HcpCustomer {
  hcpCustomerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  hcpUpdatedAt: string | null;
}

/** The CRM rows that expose a live sync caption. */
export type SyncProvider = 'zt' | 'uptick' | 'servicetrade' | 'hcp';

export interface UptickConnectInput {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

export interface ConnectionsStatus {
  /**
   * Whether the signed-in user may connect/disconnect, as decided by the SERVER from the role in
   * the verified JWT. Trust this over any local role check: the store's `user.role` comes from
   * whatever the login response included, so when it is missing the UI hides the controls from
   * admins too — silently, which is indistinguishable from the feature being broken.
   */
  canManage: boolean;
  qbo: QboConnectionStatus;
  zt: ZtConnectionStatus;
  uptick: UptickConnectionStatus;
  servicetrade: ServicetradeConnectionStatus;
  hcp: HcpConnectionStatus;
}

/** What one reference sync pulled in, for the "synced N customers" confirmation. */
export interface QboSyncCounts {
  customers: number;
  items: number;
  accounts: number;
  taxCodes: number;
  taxRates: number;
}

/** One item from the connected QuickBooks account's item list (QBO PRD US5). */
export interface QboItem {
  id: string;
  name: string;
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  return body.data as T;
}

export const connectionsService = {
  get: (): Promise<ConnectionsStatus> =>
    authFetch(`${API_BASE}/connections`, { headers: buildHeaders(false) }).then((r) =>
      json<ConnectionsStatus>(r)
    ),

  /**
   * Start the QuickBooks consent flow. Admin-only (403 otherwise). A POST, not a field on the
   * status read: the returned URL carries a signed 15-minute state naming this company, and
   * whoever approves it at Intuit binds their QuickBooks to that company — so it must not be
   * handed out on an endpoint every user can call. Expires quickly; fetch it at click time.
   */
  startQboConnect: (): Promise<{ authUrl: string }> =>
    authFetch(`${API_BASE}/connections/qbo/connect`, {
      method: "POST",
      headers: buildHeaders(),
    }).then((r) => json<{ authUrl: string }>(r)),

  /** Forget the company's QuickBooks connection. Admin-only. */
  disconnectQbo: (): Promise<ConnectionsStatus> =>
    authFetch(`${API_BASE}/connections/qbo`, {
      method: "DELETE",
      headers: buildHeaders(),
    }).then((r) => json<ConnectionsStatus>(r)),

  // DEFERRED (2026-09-04): saveQboCredentials used to PUT a per-company Intuit Client ID +
  // Secret here. Clara now owns the app and its keys live in server env, so the endpoint no
  // longer exists — reviving this means restoring it on copilot-server too (see the header of
  // copilot-server/src/lib/qbo.ts).

  /**
   * Pull QuickBooks' reference data — customers, items, the chart of accounts, tax codes and
   * rates — into CLARA's mirrors.
   *
   * Admin-only, and a write: it spends API quota against an app shared by every Clara client.
   * The server refuses a second concurrent run for the same company rather than queueing one, so
   * a 409 here means "already running", not "failed".
   *
   * This endpoint has existed since the ingestion pipeline shipped and had no caller — the only
   * way to refresh a company's customer and rate lists was for someone to hit it by hand.
   */
  syncQbo: (): Promise<{ counts: QboSyncCounts; syncedAt: string }> =>
    authFetch(`${API_BASE}/connections/qbo/sync`, {
      method: "POST",
      headers: buildHeaders(),
    }).then((r) => json<{ counts: QboSyncCounts; syncedAt: string }>(r)),

  /**
   * Connect ZenTrades with the company's ZenTrades login. Admin-only. The server validates by
   * actually logging in before storing anything, so a success here means the credentials work.
   */
  connectZt: (username: string, password: string): Promise<{ connected: boolean; ztCompanyId: string }> =>
    authFetch(`${API_BASE}/connections/zt/connect`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({ username, password }),
    }).then((r) => json<{ connected: boolean; ztCompanyId: string }>(r)),

  /** Pull jobs, deficiencies and the price catalog from ZenTrades. Admin-only. */
  syncZt: (): Promise<{ jobs: number; deficiencies: number; catalog: number; tax: number; errors: string[] }> =>
    authFetch(`${API_BASE}/connections/zt/sync`, {
      method: "POST",
      headers: buildHeaders(),
    }).then((r) => json<{ jobs: number; deficiencies: number; catalog: number; tax: number; errors: string[] }>(r)),

  /** What the running sync of that CRM is doing right now; null when idle. */
  syncProgress: (provider: SyncProvider): Promise<{ progress: string | null }> =>
    authFetch(`${API_BASE}/connections/${provider}/sync/progress`, {
      headers: buildHeaders(false),
    }).then((r) => json<{ progress: string | null }>(r)),

  /** Synced ZenTrades jobs for the new-estimate picker. Any role. */
  ztJobs: (q?: string): Promise<ZtJob[]> =>
    authFetch(`${API_BASE}/connections/zt/jobs${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
      headers: buildHeaders(false),
    }).then((r) => json<ZtJob[]>(r)),

  /** Forget the company's ZenTrades connection. Admin-only. */
  disconnectZt: (): Promise<void> =>
    authFetch(`${API_BASE}/connections/zt`, {
      method: "DELETE",
      headers: buildHeaders(),
    }).then((r) => json<void>(r)),

  /** Connect Uptick: workspace URL + OAuth app keys + a user login. Admin-only. Validated by a
   *  real token grant server-side before anything is stored. */
  connectUptick: (input: UptickConnectInput): Promise<{ connected: boolean; baseUrl: string }> =>
    authFetch(`${API_BASE}/connections/uptick/connect`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(input),
    }).then((r) => json<{ connected: boolean; baseUrl: string }>(r)),

  /** Pull tasks (jobs), remarks (defects) and products (pricebook) from Uptick. Admin-only. */
  syncUptick: (): Promise<{ tasks: number; remarks: number; products: number; errors: string[] }> =>
    authFetch(`${API_BASE}/connections/uptick/sync`, {
      method: "POST",
      headers: buildHeaders(),
    }).then((r) => json<{ tasks: number; remarks: number; products: number; errors: string[] }>(r)),

  /** Synced Uptick jobs for the new-estimate picker. Any role. */
  uptickJobs: (q?: string): Promise<UptickJob[]> =>
    authFetch(`${API_BASE}/connections/uptick/jobs${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
      headers: buildHeaders(false),
    }).then((r) => json<UptickJob[]>(r)),

  /** Forget the company's Uptick connection. Admin-only. */
  disconnectUptick: (): Promise<void> =>
    authFetch(`${API_BASE}/connections/uptick`, {
      method: "DELETE",
      headers: buildHeaders(),
    }).then((r) => json<void>(r)),

  /** Connect ServiceTrade with a username + password. Admin-only. Validated by a real login
   *  server-side before anything is stored. */
  connectServicetrade: (username: string, password: string): Promise<{ connected: boolean; stCompanyName: string | null }> =>
    authFetch(`${API_BASE}/connections/servicetrade/connect`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({ username, password }),
    }).then((r) => json<{ connected: boolean; stCompanyName: string | null }>(r)),

  /** Pull jobs, deficiencies, lib items (pricebook) and tax groups from ServiceTrade. Admin-only. */
  syncServicetrade: (): Promise<{ jobs: number; deficiencies: number; items: number; tax: number; errors: string[] }> =>
    authFetch(`${API_BASE}/connections/servicetrade/sync`, {
      method: "POST",
      headers: buildHeaders(),
    }).then((r) => json<{ jobs: number; deficiencies: number; items: number; tax: number; errors: string[] }>(r)),

  /** Synced ServiceTrade jobs for the new-estimate picker. Any role. */
  servicetradeJobs: (q?: string): Promise<ServicetradeJob[]> =>
    authFetch(`${API_BASE}/connections/servicetrade/jobs${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
      headers: buildHeaders(false),
    }).then((r) => json<ServicetradeJob[]>(r)),

  /** Forget the company's ServiceTrade connection. Admin-only. */
  disconnectServicetrade: (): Promise<void> =>
    authFetch(`${API_BASE}/connections/servicetrade`, {
      method: "DELETE",
      headers: buildHeaders(),
    }).then((r) => json<void>(r)),

  /** Connect Housecall Pro with the company's API key. Admin-only. Validated by a real call
   *  server-side before anything is stored. */
  connectHcp: (apiKey: string): Promise<{ connected: boolean; hcpCompanyName: string | null }> =>
    authFetch(`${API_BASE}/connections/hcp/connect`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({ apiKey }),
    }).then((r) => json<{ connected: boolean; hcpCompanyName: string | null }>(r)),

  /** Pull jobs, customers and the price book (materials + services) from Housecall Pro. Admin-only. */
  syncHcp: (): Promise<{ jobs: number; customers: number; items: number; errors: string[] }> =>
    authFetch(`${API_BASE}/connections/hcp/sync`, {
      method: "POST",
      headers: buildHeaders(),
    }).then((r) => json<{ jobs: number; customers: number; items: number; errors: string[] }>(r)),

  /** Synced Housecall Pro jobs for the new-estimate picker. Any role. */
  hcpJobs: (q?: string): Promise<HcpJob[]> =>
    authFetch(`${API_BASE}/connections/hcp/jobs${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
      headers: buildHeaders(false),
    }).then((r) => json<HcpJob[]>(r)),

  /** Synced Housecall Pro customers for the "from a customer" (no job) picker. Any role. */
  hcpCustomers: (q?: string): Promise<HcpCustomer[]> =>
    authFetch(`${API_BASE}/connections/hcp/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
      headers: buildHeaders(false),
    }).then((r) => json<HcpCustomer[]>(r)),

  /** Forget the company's Housecall Pro connection. Admin-only. */
  disconnectHcp: (): Promise<void> =>
    authFetch(`${API_BASE}/connections/hcp`, {
      method: "DELETE",
      headers: buildHeaders(),
    }).then((r) => json<void>(r)),

  /** The connected QBO account's items, for the per-line dropdown. 409s until connected. */
  qboItems: (): Promise<QboItem[]> =>
    authFetch(`${API_BASE}/connections/qbo/items`, { headers: buildHeaders(false) }).then((r) =>
      json<QboItem[]>(r)
    ),
};

/** Company default markup % — the starting markup of NEW quotes only (QBO PRD US7). */
export const markupSettingsService = {
  get: (): Promise<{ defaultMarkupPercent: number }> =>
    authFetch(`${API_BASE}/markup`, { headers: buildHeaders(false) }).then((r) =>
      json<{ defaultMarkupPercent: number }>(r)
    ),
  update: (defaultMarkupPercent: number): Promise<{ defaultMarkupPercent: number }> =>
    authFetch(`${API_BASE}/markup`, {
      method: "PUT",
      headers: buildHeaders(),
      body: JSON.stringify({ defaultMarkupPercent }),
    }).then((r) => json<{ defaultMarkupPercent: number }>(r)),
};

/** A customer, as the estimate screen's picker sees it. */
export interface CustomerOption {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  /** The QuickBooks id, when this customer has been synced to the connected file. */
  qboId: string | null;
  /**
   * QuickBooks' FullyQualifiedName — the parent chain, "Customer:Job:Sub-job". Null when it says
   * nothing the name does not already (top-level customers), so the picker only shows it when it
   * actually disambiguates.
   */
  fullyQualifiedName: string | null;
}

/**
 * Customers for the estimate screen (architecture, 2026-09-08: CLARA owns the customer, a
 * customer_qb row holds what QuickBooks knows).
 *
 * Both calls are open to every role — a technician on site picks the customer, and an admin gate
 * would block posting the estimate until someone at the office logs in. Search reads CLARA's own
 * customers, so it works identically for a company with no accounting integration, costs nothing
 * per keystroke, and survives QuickBooks being down.
 */
export const customersService = {
  search: (q: string): Promise<CustomerOption[]> =>
    authFetch(`${API_BASE}/qbo/customers?q=${encodeURIComponent(q)}`, {
      headers: buildHeaders(false),
    }).then((r) => json<CustomerOption[]>(r)),

  /**
   * Create the customer. In QuickBooks too when the company is connected — an estimate cannot be
   * posted until its customer exists there.
   */
  create: (input: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    /**
     * Make this a sub-customer of an existing one — QuickBooks calls the child a Job. The parent
     * has to already exist in QuickBooks; the server refuses one that has not synced yet, because
     * a child cannot be created without its parent's id there.
     */
    parentId?: number;
  }): Promise<{
    customerId: number;
    name: string;
    qboId: string | null;
    /**
     * Parts of the address the server could not find in what was typed. It structures the text
     * but never invents a missing component — a guessed ZIP would change which tax jurisdiction
     * the customer is billed under — so this is the cue to ask for them.
     */
    addressMissing?: string[];
  }> =>
    authFetch(`${API_BASE}/qbo/customers`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(input),
    }).then((r) =>
      json<{
        customerId: number;
        name: string;
        qboId: string | null;
        addressMissing?: string[];
      }>(r)
    ),
};

/** One of the company's sales-tax rates (settings → tax settings). */
export interface SalesTaxRate {
  id: number;
  name: string;
  /** "MANUAL" (typed here), "QBO", or "ZENTRADES" (ingested from the connected system). */
  source: string;
  ratePercent: number;
  isDefault: boolean;
  isActive: boolean;
  /**
   * Whether this rate can actually be applied right now. Computed by the server against the
   * connection state, not stored — a MANUAL rate is unusable while the company takes its tax
   * from a connected system, and usable again once it disconnects.
   */
  usable: boolean;
  qb: { qboType: string; qboId: string }[];
}

/** Where a company's tax comes from. Decides whether rates can be created here at all. */
export interface SalesTaxSettings {
  taxSource: 'quickbooks' | 'zentrades' | 'servicetrade' | 'crm' | 'manual';
  /**
   * Whether sales tax applies to this company at all. False means new estimates start with no
   * rate — distinct from "no default set", which means they charge tax but have not said which.
   *
   * Optional because the server may predate it: Amplify and ECS deploy independently, so treat
   * `undefined` as ON rather than OFF. Reading a missing field as "tax is off" would blank the
   * tax controls for every company the moment this app shipped ahead of the API.
   */
  taxEnabled?: boolean;
  /** True when a connection forces it on — the switch shows on and locked, with the reason. */
  taxEnforced?: boolean;
  /**
   * Which integration is forcing it. Read this rather than `taxSource` for the reason text: a CRM
   * forces tax on WITHOUT owning the rates, so `taxSource` is still "manual" for those companies
   * and using it would tell them their rates come from a system that does not hold any.
   */
  taxEnforcedBy?: 'quickbooks' | 'zentrades' | 'crm' | null;
  rates: SalesTaxRate[];
}

/**
 * Sales-tax rates. Reads are open to every role because an estimate has to show the rate it is
 * applying; writes are admin-only, since this is a percentage applied to customer-facing money.
 */
export const salesTaxService = {
  list: (): Promise<SalesTaxSettings> =>
    authFetch(`${API_BASE}/sales-tax`, { headers: buildHeaders(false) }).then((r) =>
      json<SalesTaxSettings>(r)
    ),

  save: (rate: {
    id?: number;
    name: string;
    ratePercent: number;
    isActive?: boolean;
    isDefault?: boolean;
  }): Promise<SalesTaxRate> =>
    authFetch(`${API_BASE}/sales-tax`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(rate),
    }).then((r) => json<SalesTaxRate>(r)),

  /**
   * Offer a rate, or stop offering it — including one that came from QuickBooks.
   *
   * Its own endpoint rather than a flag on `save`, because `save` refuses every write while a
   * connected system owns the company's tax, which is exactly when this has to work. Nothing is
   * written to QuickBooks; the rate still exists there and a later sync still sees it.
   *
   * Deactivating rather than deleting is not a soft touch: estimates reference the rate they were
   * created with (`quotes.sales_tax_id`, ON DELETE RESTRICT), so a delete would either be refused
   * or strand an estimate quoting a rate that belongs to nothing.
   *
   * Returns the whole settings payload, because switching off the default also clears it.
   */
  setActive: (id: number, isActive: boolean): Promise<SalesTaxSettings> =>
    authFetch(`${API_BASE}/sales-tax/${id}/active`, {
      method: "PUT",
      headers: buildHeaders(),
      body: JSON.stringify({ isActive }),
    }).then((r) => json<SalesTaxSettings>(r)),

  /**
   * Turn sales tax on or off for the whole company.
   *
   * Refused with a 409 while QuickBooks is connected, which forces it on — the server declines
   * rather than accepting a write it would then ignore.
   */
  setTaxEnabled: (taxEnabled: boolean): Promise<SalesTaxSettings> =>
    authFetch(`${API_BASE}/tax-enabled`, {
      method: "PUT",
      headers: buildHeaders(),
      body: JSON.stringify({ taxEnabled }),
    }).then((r) => json<SalesTaxSettings>(r)),

  /** Choose the rate new estimates start with; null leaves new estimates untaxed. */
  setDefault: (id: number | null): Promise<SalesTaxSettings> =>
    authFetch(`${API_BASE}/sales-tax/default`, {
      method: "PUT",
      headers: buildHeaders(),
      body: JSON.stringify({ id }),
    }).then((r) => json<SalesTaxSettings>(r)),
};
