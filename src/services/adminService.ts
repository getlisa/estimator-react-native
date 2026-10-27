/**
 * Internal Clara-team admin API (copilot-server /api/v1/op-x7k2). Deliberately
 * unauthenticated — access is by knowing the non-obvious URL, the same hidden-page
 * pattern as company registration. Never link to it from any user-facing surface.
 */

import { appendFiles, type PickedFile } from "@/lib/upload";
import { COPILOT_API_BASE } from "@/services/copilotChatService";

const API_BASE = `${COPILOT_API_BASE}/op-x7k2`;

const headers = (json = true): Record<string, string> =>
  json ? { "Content-Type": "application/json" } : {};

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  return body.data as T;
}

export interface AdminCompany {
  id: number;
  name: string;
}

export interface AdminCompanyDetail extends AdminCompany {
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  licenseNumber: string | null;
  website: string | null;
  footerTerms: string | null;
  address: unknown;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  hdFallbackEnabled: boolean;
  pricebookCount: number;
  laborRateCount: number;
}


/** A block of a company's proposal document format (mirrors the server's ProposalBlock). */
export type ProposalDynamicType =
  | "logo"
  | "contactLine"
  | "projectBlock"
  | "scopeOfWork"
  | "lineItems"
  | "costSummary"
  | "preparedBy"
  | "photos";

export interface ProposalBlockStyle {
  align?: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
}

export interface ProposalStaticPart {
  format: "paragraph" | "bullets" | "numbered";
  text?: string;
  items?: string[];
  label?: string;
  style?: ProposalBlockStyle;
}

export interface ProposalBlock {
  id: string;
  heading?: string;
  visible: boolean;
  style?: ProposalBlockStyle;
  dynamic?: ProposalDynamicType;
  /** projectBlock only: render as the boxed info-table pair (set by document import). */
  boxed?: boolean;
  /** logo only: rendered size in points. Server default is 90. */
  logoSize?: number;
  content?: ProposalStaticPart[];
}

/** One named proposal design in a company's template library. */
export interface AdminProposalTemplate {
  /** Set when this template renders from a hand-authored HTML file in the repo. */
  htmlFile?: string | null;
  /** Set when this template carries an uploaded HTML document of its own. */
  html?: string | null;
  id: number;
  name: string;
  blocks: ProposalBlock[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalTemplateLibrary {
  templates: AdminProposalTemplate[];
  /** What renders when a company has no templates — the built-in standard proposal. */
  builtinBlocks: ProposalBlock[];
}

export interface ProposalImportResult {
  blocks: ProposalBlock[];
  /** Formatting-was-estimated / could-not-classify notices, shown above the editor. */
  warnings: string[];
  saved: boolean;
}

export interface AdminPricebook {
  id: number;
  name: string;
  priority: number;
  sourceFormat: string | null;
  originalFilename: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IngestResult {
  pricebook: { id: number; name: string };
  ingested: number;
  skipped: { line: number; reason: string; sheet?: string }[];
  repricedDraftLines: number;
  /** Which spreadsheet headers were read as what — shown so a mis-mapped sheet is obvious. */
  columns?: { code?: string; description: string; price: string; unit?: string };
}

export interface AdminLaborRate {
  id: number;
  name: string;
  hourlyRate: number;
}

export interface AdminTemplate {
  id: number;
  name: string;
  renderer: string;
  isActive: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  /** Price-memory learning permission (price-memory PRD): this technician's prices are remembered. */
  priceMemoryLearner: boolean;
}

export interface AdminPriceMemory {
  id: number;
  name: string;
  description: string | null;
  rate: number;
  isLabor: boolean;
  isActive: boolean;
  setBy: string | null;
  setAt: string;
}

export interface AdminConversation {
  quoteId: string;
  conversationId: string;
  status: "DRAFT" | "COMPLETED";
  lineItemCount: number;
  firstMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export const adminService = {
  listCompanies: (): Promise<AdminCompany[]> =>
    fetch(`${API_BASE}/companies`, { headers: headers(false) }).then((r) => json(r)),

  getCompany: (companyId: number): Promise<AdminCompanyDetail> =>
    fetch(`${API_BASE}/companies/${companyId}`, { headers: headers(false) }).then((r) => json(r)),

  patchConfig: (companyId: number, patch: Record<string, unknown>): Promise<AdminCompanyDetail> =>
    fetch(`${API_BASE}/companies/${companyId}/config`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(patch),
    }).then((r) => json(r)),

  uploadLogo: async (companyId: number, file: PickedFile): Promise<{ logoUrl: string }> => {
    const form = new FormData();
    await appendFiles(form, "logo", [file]);
    return fetch(`${API_BASE}/companies/${companyId}/logo`, {
      method: "POST",
      headers: headers(false),
      body: form,
    }).then((r) => json(r));
  },

  // ---------- proposal document format ----------

  listProposalTemplates: (companyId: number): Promise<ProposalTemplateLibrary> =>
    fetch(`${API_BASE}/companies/${companyId}/proposal-templates`, {
      headers: headers(false),
    }).then((r) => json(r)),

  createProposalTemplate: (
    companyId: number,
    name: string,
    blocks?: ProposalBlock[]
  ): Promise<AdminProposalTemplate> =>
    fetch(`${API_BASE}/companies/${companyId}/proposal-templates`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(blocks ? { name, blocks } : { name }),
    }).then((r) => json(r)),

  updateProposalTemplate: (
    id: number,
    patch: { name?: string; blocks?: ProposalBlock[] }
  ): Promise<AdminProposalTemplate> =>
    fetch(`${API_BASE}/proposal-templates/${id}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(patch),
    }).then((r) => json(r)),

  /** 409s when deleting the default while other templates exist — surface the message. */
  deleteProposalTemplate: (id: number): Promise<void> =>
    fetch(`${API_BASE}/proposal-templates/${id}`, {
      method: "DELETE",
      headers: headers(false),
    }).then((r) => json(r)),

  setDefaultProposalTemplate: (id: number): Promise<void> =>
    fetch(`${API_BASE}/proposal-templates/${id}/default`, {
      method: "PUT",
      headers: headers(false),
    }).then((r) => json(r)),

  /** Upload an existing proposal; returns parsed blocks for review. Nothing is saved yet. */
  importProposalTemplate: async (companyId: number, file: PickedFile): Promise<ProposalImportResult> => {
    const form = new FormData();
    await appendFiles(form, "file", [file]);
    return fetch(`${API_BASE}/companies/${companyId}/proposal-template/import`, {
      method: "POST",
      headers: headers(false),
      body: form,
    }).then((r) => json(r));
  },

  /**
   * Ingest an .html document as a company's proposal template. The server sanitises it and
   * reports what it removed; `templateId` replaces an existing row instead of adding one.
   */
  ingestHtmlProposalTemplate: async (
    companyId: number,
    file: PickedFile,
    opts: { name?: string; templateId?: number } = {}
  ): Promise<{ template: AdminProposalTemplate; removed: string[] }> => {
    const form = new FormData();
    await appendFiles(form, "file", [file]);
    if (opts.name) form.append("name", opts.name);
    if (opts.templateId != null) form.append("templateId", String(opts.templateId));
    return fetch(`${API_BASE}/companies/${companyId}/proposal-templates/html`, {
      method: "POST",
      headers: headers(false),
      body: form,
    }).then((r) => json(r));
  },

  /** The URL that renders a company's HTML document with sample data, for a browser tab. */
  htmlProposalPreviewUrl: (companyId: number): string =>
    `${API_BASE}/companies/${companyId}/proposal-template/html`,

  /** Render a PDF preview of the given blocks (unsaved edits included). */
  previewProposalTemplate: async (companyId: number, blocks?: ProposalBlock[]): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/proposal-template/preview`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(blocks ? { blocks } : {}),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error?.message ?? `Preview failed (${res.status})`);
    }
    return res.blob();
  },

  listPricebooks: (companyId: number): Promise<AdminPricebook[]> =>
    fetch(`${API_BASE}/companies/${companyId}/pricebooks`, { headers: headers(false) }).then((r) =>
      json(r)
    ),

  createPricebook: async (
    companyId: number,
    file: PickedFile,
    name: string,
    priority: number
  ): Promise<IngestResult> => {
    const form = new FormData();
    await appendFiles(form, "file", [file]);
    form.append("name", name);
    form.append("priority", String(priority));
    return fetch(`${API_BASE}/companies/${companyId}/pricebooks`, {
      method: "POST",
      headers: headers(false),
      body: form,
    }).then((r) => json(r));
  },

  replacePricebookFile: async (pricebookId: number, file: PickedFile): Promise<IngestResult> => {
    const form = new FormData();
    await appendFiles(form, "file", [file]);
    return fetch(`${API_BASE}/pricebooks/${pricebookId}/file`, {
      method: "PUT",
      headers: headers(false),
      body: form,
    }).then((r) => json(r));
  },

  reorderPricebooks: (
    companyId: number,
    orders: { id: number; priority: number }[]
  ): Promise<{ repricedDraftLines: number }> =>
    fetch(`${API_BASE}/companies/${companyId}/pricebooks/priorities`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ orders }),
    }).then((r) => json(r)),

  deletePricebook: (pricebookId: number): Promise<{ repricedDraftLines: number }> =>
    fetch(`${API_BASE}/pricebooks/${pricebookId}`, {
      method: "DELETE",
      headers: headers(false),
    }).then((r) => json(r)),

  listLaborRates: (companyId: number): Promise<AdminLaborRate[]> =>
    fetch(`${API_BASE}/companies/${companyId}/labor-rates`, { headers: headers(false) }).then((r) =>
      json(r)
    ),

  createLaborRate: (companyId: number, name: string, hourlyRate: number): Promise<AdminLaborRate> =>
    fetch(`${API_BASE}/companies/${companyId}/labor-rates`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ name, hourlyRate }),
    }).then((r) => json(r)),

  updateLaborRate: (
    id: number,
    patch: { name?: string; hourlyRate?: number }
  ): Promise<AdminLaborRate> =>
    fetch(`${API_BASE}/labor-rates/${id}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(patch),
    }).then((r) => json(r)),

  deleteLaborRate: (id: number): Promise<{ repricedDraftLines: number }> =>
    fetch(`${API_BASE}/labor-rates/${id}`, {
      method: "DELETE",
      headers: headers(false),
    }).then((r) => json(r)),

  // ---------- organization price memory ----------

  listUsers: (companyId: number): Promise<AdminUser[]> =>
    fetch(`${API_BASE}/companies/${companyId}/users`, { headers: headers(false) }).then((r) =>
      json(r)
    ),

  setPriceMemoryLearner: (userId: string, priceMemoryLearner: boolean): Promise<void> =>
    fetch(`${API_BASE}/users/${userId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ priceMemoryLearner }),
    }).then((r) => json(r)),

  listPriceMemory: (companyId: number): Promise<AdminPriceMemory[]> =>
    fetch(`${API_BASE}/companies/${companyId}/price-memory`, { headers: headers(false) }).then(
      (r) => json(r)
    ),

  updatePriceMemory: (
    id: number,
    patch: Partial<Pick<AdminPriceMemory, "name" | "description" | "rate" | "isLabor" | "isActive">>
  ): Promise<void> =>
    fetch(`${API_BASE}/price-memory/${id}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(patch),
    }).then((r) => json(r)),

  deletePriceMemory: (id: number): Promise<void> =>
    fetch(`${API_BASE}/price-memory/${id}`, {
      method: "DELETE",
      headers: headers(false),
    }).then((r) => json(r)),

  listTemplates: (companyId: number): Promise<AdminTemplate[]> =>
    fetch(`${API_BASE}/companies/${companyId}/templates`, { headers: headers(false) }).then((r) =>
      json(r)
    ),

  /** Upload a .docx template with placeholders — compile-checked server-side. */
  uploadTemplate: async (companyId: number, file: PickedFile, name: string): Promise<AdminTemplate> => {
    const form = new FormData();
    await appendFiles(form, "file", [file]);
    form.append("name", name);
    return fetch(`${API_BASE}/companies/${companyId}/templates`, {
      method: "POST",
      headers: headers(false),
      body: form,
    }).then((r) => json(r));
  },

  deleteTemplate: (id: number): Promise<{ deleted: boolean }> =>
    fetch(`${API_BASE}/templates/${id}`, {
      method: "DELETE",
      headers: headers(false),
    }).then((r) => json(r)),

  listConversations: (companyId: number): Promise<AdminConversation[]> =>
    fetch(`${API_BASE}/companies/${companyId}/conversations`, { headers: headers(false) }).then(
      (r) => json(r)
    ),

  deleteConversations: (
    companyId: number,
    quoteIds: string[],
    includeCompleted: boolean
  ): Promise<{ deleted: number }> =>
    fetch(`${API_BASE}/companies/${companyId}/conversations`, {
      method: "DELETE",
      headers: headers(),
      body: JSON.stringify({ quoteIds, includeCompleted }),
    }).then((r) => json(r)),
};
