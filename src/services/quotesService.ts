import { buildHeaders } from "@/services/copilotChatService";
import { authFetch } from "@/services/authFetch";
import type { QuestionAnswer } from "@/types/copilot";
import { saveOrShare } from "@/lib/download";
import { appendFiles, type PickedFile } from "@/lib/upload";

/**
 * Estimating Agent API — chat-as-quote lifecycle (Draft → Completed).
 * Backend: copilot-server /api/v1/quotes (auth'd, scoped to the technician).
 */

const API_BASE = `${process.env.EXPO_PUBLIC_COPILOT_BASE_URL}/api/v1/quotes`;

export type LineItemFlag =
  | "ambiguous"
  | "estimated_price"
  | "missing_quantity"
  | "unmatched"
  | "manually_edited";

export interface AmbiguousAction {
  action: "remove" | "update";
  candidateItemIds: string[];
  referenceText: string;
  fields?: { description?: string; quantity?: number; unit?: string };
}

/**
 * Catalog provenance for a line priced from an external source (Home Depot today).
 * Null when the line is unpriced or priced from the company's own pricebook.
 *
 * Render `link` as an anchor from this field — never from text the model produced, since a
 * regenerated product URL can silently corrupt the slug or id.
 */
export interface LineItemProduct {
  productId: string | null;
  link: string | null;
  brand: string | null;
  rating: number | null;
  packageQuantity: number | null;
  /** True until a technician accepts the line this was resolved for. */
  provisional: boolean;
}

export interface QuoteLineItem {
  id: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  pricebookCode: string | null;
  /**
   * Labor/diagnostic time rather than a purchasable material. The quote's markup applies to
   * materials only, so this is what decides whether this line's price carries markup.
   */
  isLabor: boolean;
  product: LineItemProduct | null;
  /** Price came from a live web search, not the catalog — no product id stands behind it. */
  priceEstimated?: boolean;
  /** Product URL when the search gave a real-looking one, else a Home Depot search URL. */
  estimateLink?: string | null;
  /**
   * Where this line's price came from: a pricebook's name, "Home Depot — online fallback",
   * or null for a manually entered price (review-screen only — never on the exported quote).
   */
  priceSource?: string | null;
  flags: LineItemFlag[];
  ambiguousAction: AmbiguousAction | null;
  /** Alternative-option group ("Option A – …"); null/undefined = base scope. */
  optionGroup?: string | null;
  /** Catalog-shaped term behind the line — the auto QBO item name (QBO PRD US5). */
  searchTerm?: string | null;
  /** QBO item this line bills against; null = auto match/create at post time. */
  qboItemId?: string | null;
  qboItemName?: string | null;
  /** Whether sales tax applies to this line. Labor and fees are typically false. */
  taxable: boolean;
  sortOrder: number;
}

export interface QuoteOptionTotal {
  name: string;
  total: number;
  /** Base scope + this option, BEFORE tax. */
  combinedTotal: number;
  /** Tax on base + this option's taxable lines. 0 when the quote carries no rate. */
  taxAmount: number;
  /** What the customer pays for this option, tax included. */
  combinedTotalWithTax: number;
}

export interface Quote {
  id: string;
  conversationId: string;
  status: "DRAFT" | "COMPLETED";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  lineItems: QuoteLineItem[];
  /**
   * Materials markup percentage. Every price in `lineItems` already has it applied — never
   * multiply by it again; it exists here only to fill the Markup input.
   */
  markupPercent: number;
  /** Customer details — free text, all optional, editable in Draft only. */
  /**
   * The customer this estimate bills to; null until one is chosen or created. The QuickBooks id
   * is not carried here — it lives on customer_qb, keyed by realm.
   */
  customerId: number | null;
  customerName: string | null;
  customerAddress: string | null;
  customerPhone: string | null;
  /**
   * The linked customer's email, read live off that customer rather than stored on the quote the
   * way the three fields above are — no document prints it, and the address a proposal is sent to
   * should be the one the customer has now. Null when nothing is linked, or when they have none.
   */
  customerEmail: string | null;
  /** Base scope, BEFORE tax. */
  total: number;
  /**
   * The rate this estimate was created under — a snapshot, not the company's current default.
   * **Null and 0 mean different things**: null is "no rate configured, show no tax line at all",
   * 0 is a deliberate zero that still prints. Editable while the quote is a DRAFT.
   */
  taxRatePercent: number | null;
  salesTaxId: number | null;
  /** The part of `total` that tax applies to — excludes lines marked non-taxable. */
  taxableSubtotal: number;
  taxAmount: number;
  /** Base scope including tax — what the estimate bills when there are no option groups. */
  totalWithTax: number;
  optionTotals?: QuoteOptionTotal[];
  /** The option the customer chose, captured at completion (QBO PRD US3). */
  chosenOptionGroup?: string | null;
  /**
   * QuickBooks sync state, for the QB badge and the retry prompt. An estimate id with an error
   * set means it posted once and a later attempt failed; both null means never attempted.
   */
  qboEstimateId: string | null;
  qboSyncedAt: string | null;
  qboSyncError: string | null;
  /** ZenTrades linkage + sync state — same semantics as the qbo trio. */
  ztTicketId: string | null;
  ztEstimateId: string | null;
  ztSyncedAt: string | null;
  ztSyncError: string | null;
  /** Uptick linkage + sync state — same semantics again. */
  uptickTaskId: string | null;
  uptickQuoteId: string | null;
  uptickQuoteRef: string | null;
  uptickSyncedAt: string | null;
  uptickSyncError: string | null;
  /** ServiceTrade linkage + sync state — same semantics again. */
  stJobId: string | null;
  stQuoteId: string | null;
  stQuoteRef: string | null;
  stSyncedAt: string | null;
  stSyncError: string | null;
  /** Housecall Pro linkage + sync state — same semantics again. hcpEstimateRef is HCP's estimate number. */
  hcpJobId: string | null;
  hcpEstimateId: string | null;
  hcpEstimateRef: string | null;
  hcpSyncedAt: string | null;
  hcpSyncError: string | null;
  /** The linked customer's Housecall Pro id — a quote started from an HCP customer (no job) posts through it. */
  hcpCustomerId: string | null;
  blockingFlagCount: number;
}

/** An image attached directly to the quote (not sent through the chat/agent). */
export interface QuoteImage {
  id: string;
  url: string;
  mimeType: string;
  filename: string | null;
  createdAt: string;
}

export interface QuoteMessageAttachment {
  id: string;
  url?: string;
  type?: string;
  filename?: string;
  size?: number;
  metadata?: { s3Key?: string } | null;
}

export interface QuoteMessage {
  id: string;
  senderType: "USER" | "AI" | "SYSTEM";
  content: string;
  contentType?: string;
  attachments?: QuoteMessageAttachment[];
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface QuoteWithMessages extends Quote {
  messages: QuoteMessage[];
}

export interface SendMessageOptions {
  imageUrls?: string[];
  /** Answers picked on a question card, stored so the card keeps showing them. */
  answers?: QuestionAnswer[];
  /** Id of the AI message whose questions these answers belong to. */
  answeredMessageId?: string;
}

/** Error with the server's structured extras, e.g. OPTION_CHOICE_REQUIRED + its options. */
export type ApiError = Error & { code?: string; options?: QuoteOptionTotal[] };

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(body?.error?.message ?? `HTTP ${res.status}`) as ApiError;
    err.code = body?.error?.code;
    err.options = body?.error?.options;
    throw err;
  }
  return body.data as T;
}

export const quotesService = {
  /** A CRM job id (or a Housecall Pro customer id) seeds the new estimate — chat opens pre-filled. One at most. */
  create: (seed?: { ztTicketId?: string; uptickTaskId?: string; stJobId?: string; hcpJobId?: string; hcpCustomerId?: string }): Promise<Quote> =>
    authFetch(API_BASE, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(seed ?? {}),
    }).then((r) => json<Quote>(r)),

  list: (status: "DRAFT" | "COMPLETED"): Promise<Quote[]> =>
    authFetch(`${API_BASE}?status=${status}`, { headers: buildHeaders() }).then(
      (r) => json<Quote[]>(r)
    ),

  get: (quoteId: string): Promise<QuoteWithMessages> =>
    authFetch(`${API_BASE}/${quoteId}`, { headers: buildHeaders() }).then((r) =>
      json<QuoteWithMessages>(r)
    ),

  sendMessage: (
    quoteId: string,
    content: string,
    options?: SendMessageOptions
  ): Promise<{ reply: QuoteMessage; quote: Quote }> =>
    authFetch(`${API_BASE}/${quoteId}/messages`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        content,
        ...(options?.imageUrls?.length ? { imageUrls: options.imageUrls } : {}),
        // Sent together: the server only trusts answers that name an AI turn of this quote.
        // It accepts either these objects or a bare value list, and persists both shapes.
        ...(options?.answers?.length && options.answeredMessageId
          ? { answers: options.answers, answeredMessageId: options.answeredMessageId }
          : {}),
      }),
    }).then((r) => json<{ reply: QuoteMessage; quote: Quote }>(r)),

  /** Quote-level fields: markup % and customer details. Draft only (server 409s otherwise). */
  updateQuote: (
    quoteId: string,
    patch: {
      markupPercent?: number;
      customerName?: string | null;
      customerAddress?: string | null;
      customerPhone?: string | null;
      /** Link (or, with null, unlink) the customer this estimate bills to. */
      customerId?: number | null;
      /**
       * Change this estimate's sales-tax rate. `null` marks the job deliberately UNTAXED — which
       * the server records as a decision, so completing the quote does not helpfully put the
       * company default back on a job someone just exempted.
       */
      salesTaxId?: number | null;
    }
  ): Promise<Quote> =>
    authFetch(`${API_BASE}/${quoteId}`, {
      method: "PATCH",
      headers: buildHeaders(),
      body: JSON.stringify(patch),
    }).then((r) => json<Quote>(r)),

  /**
   * Send this estimate to QuickBooks now (QBO PRD US8).
   *
   * Completed quotes only — completion is the event that puts an estimate in the books, so this
   * re-runs exactly that: creating the estimate, or updating the one this quote already has
   * rather than adding a second. Offered per estimate instead of migrating history, so an older
   * quote reaches QuickBooks when someone actually wants it there.
   */
  /** Retry / push this completed estimate to ZenTrades (mirror of syncToQbo). */
  syncToUptick: (quoteId: string): Promise<Quote> =>
    authFetch(`${API_BASE}/${quoteId}/uptick`, {
      method: "POST",
      headers: buildHeaders(),
    }).then((r) => json<Quote>(r)),

  /** Retry / push this completed estimate to ServiceTrade (mirror of syncToUptick). */
  syncToServicetrade: (quoteId: string): Promise<Quote> =>
    authFetch(`${API_BASE}/${quoteId}/servicetrade`, {
      method: "POST",
      headers: buildHeaders(),
    }).then((r) => json<Quote>(r)),

  /** Retry / push this completed estimate to Housecall Pro as an Estimate (created once, then updated in place). */
  syncToHcp: (quoteId: string): Promise<Quote> =>
    authFetch(`${API_BASE}/${quoteId}/hcp`, {
      method: "POST",
      headers: buildHeaders(),
    }).then((r) => json<Quote>(r)),

  syncToZt: (quoteId: string): Promise<Quote> =>
    authFetch(`${API_BASE}/${quoteId}/zt`, {
      method: "POST",
      headers: buildHeaders(),
    }).then((r) => json<Quote>(r)),

  syncToQbo: (quoteId: string): Promise<{ estimateId: string; updated: boolean }> =>
    authFetch(`${API_BASE}/${quoteId}/qbo`, {
      method: "POST",
      headers: buildHeaders(),
    }).then((r) => json<{ estimateId: string; updated: boolean }>(r)),

  /** The quote's directly-attached images (not chat-message photos). */
  listImages: (quoteId: string): Promise<QuoteImage[]> =>
    authFetch(`${API_BASE}/${quoteId}/images`, { headers: buildHeaders(false) }).then((r) =>
      json<QuoteImage[]>(r)
    ),

  /** Attach images to the quote itself — never routed through the chat agent. */
  uploadImages: async (quoteId: string, files: PickedFile[]): Promise<QuoteImage[]> => {
    const form = new FormData();
    await appendFiles(form, "images", files);
    return authFetch(`${API_BASE}/${quoteId}/images`, {
      method: "POST",
      headers: buildHeaders(false),
      body: form,
    }).then((r) => json<QuoteImage[]>(r));
  },

  removeImage: (quoteId: string, imageId: string): Promise<QuoteImage[]> =>
    authFetch(`${API_BASE}/${quoteId}/images/${imageId}`, {
      method: "DELETE",
      headers: buildHeaders(false),
    }).then((r) => json<QuoteImage[]>(r)),

  addItem: (
    quoteId: string,
    item: {
      description: string;
      quantity?: number | null;
      unit?: string | null;
      unitPrice?: number | null;
      totalPrice?: number | null;
      /**
       * Adds the line as labor rather than material. The estimate screen sets it from which
       * section the Add button belongs to; the agent classifies spoken lines itself.
       *
       * It decides two things server-side that cannot be corrected by a follow-up patch without a
       * second round trip: labor is exempt from the quote's markup, and it is seeded `taxable:
       * false`, matching the unticked "Taxed" column the estimate PDF has always printed for it.
       */
      isLabor?: boolean;
      /**
       * Overrides the `!isLabor` taxable default at creation — a taxable permit fee, an untaxed
       * material. Omit it to take the default.
       *
       * A copilot-server that predates this ignores it and applies `!isLabor`, so the caller has
       * to compare what came back rather than assume it took.
       */
      taxable?: boolean;
      /**
       * The QuickBooks item this line bills against; null (the default) resolves it from the
       * description at post time. Same skew caveat as `taxable` — an older server ignores it.
       */
      qboItemId?: string | null;
      qboItemName?: string | null;
    }
  ): Promise<QuoteLineItem> =>
    authFetch(`${API_BASE}/${quoteId}/items`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(item),
    }).then((r) => json<QuoteLineItem>(r)),

  updateItem: (
    quoteId: string,
    itemId: string,
    patch: {
      description?: string;
      quantity?: number | null;
      unit?: string | null;
      unitPrice?: number;
      totalPrice?: number;
      isLabor?: boolean;
      resolveCandidateId?: string;
      /** Per-line QBO item pick (QBO PRD US5); null clears back to auto match/create. */
      qboItemId?: string | null;
      qboItemName?: string | null;
      /** Per-line Taxable toggle — drives TaxCodeRef (TAX/NON) on the posted estimate. */
      taxable?: boolean;
    }
  ): Promise<Quote> =>
    authFetch(`${API_BASE}/${quoteId}/items/${itemId}`, {
      method: "PATCH",
      headers: buildHeaders(),
      body: JSON.stringify(patch),
    }).then((r) => json<Quote>(r)),

  /** On-demand catalog price search for one line. Cold search runs 15–30s. */
  priceItem: (quoteId: string, itemId: string): Promise<Quote> =>
    authFetch(`${API_BASE}/${quoteId}/items/${itemId}/price`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({}),
    }).then((r) => json<Quote>(r)),

  removeItem: (quoteId: string, itemId: string): Promise<Quote> =>
    authFetch(`${API_BASE}/${quoteId}/items/${itemId}`, {
      method: "DELETE",
      headers: buildHeaders(),
    }).then((r) => json<Quote>(r)),

  /**
   * Completion posts the estimate to QuickBooks server-side (QBO PRD US2). A quote with
   * either/or options 409s with code OPTION_CHOICE_REQUIRED until `chosenOption` names the
   * option the customer picked (QBO PRD US3).
   */
  complete: (quoteId: string, chosenOption?: string): Promise<Quote> =>
    authFetch(`${API_BASE}/${quoteId}/complete`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(chosenOption ? { chosenOption } : {}),
    }).then((r) => json<Quote>(r)),

  reopen: (quoteId: string): Promise<Quote> =>
    authFetch(`${API_BASE}/${quoteId}/reopen`, {
      method: "POST",
      headers: buildHeaders(),
    }).then((r) => json<Quote>(r)),

  /** Drafted proposal email (to/subject/body) for in-app review before sending. */
  emailDraft: (quoteId: string): Promise<{ to: string; subject: string; body: string }> =>
    authFetch(`${API_BASE}/${quoteId}/email-draft`, { headers: buildHeaders(false) }).then((r) =>
      json<{ to: string; subject: string; body: string }>(r)
    ),

  /** Send the reviewed proposal email with the .docx attached (sent server-side). */
  emailProposal: (
    quoteId: string,
    draft: { to: string; subject: string; body: string }
  ): Promise<{ sent: boolean; to: string }> =>
    authFetch(`${API_BASE}/${quoteId}/email`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(draft),
    }).then((r) => json<{ sent: boolean; to: string }>(r)),

  /** Fetch the branded bid-proposal .docx as a blob (for preview or download). */
  proposalBlob: async (quoteId: string): Promise<{ blob: Blob; filename: string }> => {
    const res = await authFetch(`${API_BASE}/${quoteId}/proposal-docx`, {
      headers: buildHeaders(false),
    });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const filename =
      res.headers
        .get("Content-Disposition")
        ?.match(/filename="(.+)"/)?.[1] ?? "proposal.docx";
    return { blob, filename };
  },

  /** Fetch the bid-proposal as a PDF — what the email flow attaches and previews. */
  proposalPdfBlob: async (quoteId: string): Promise<{ blob: Blob; filename: string }> => {
    const res = await authFetch(`${API_BASE}/${quoteId}/proposal-pdf`, {
      headers: buildHeaders(false),
    });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const filename =
      res.headers
        .get("Content-Disposition")
        ?.match(/filename="(.+)"/)?.[1] ?? "proposal.pdf";
    return { blob, filename };
  },

  /**
   * Download the bid proposal as .docx — rendered under the company's own proposal format
   * when one is saved in the admin console (the same format the emailed PDF uses).
   */
  downloadProposalDocx: async (quoteId: string): Promise<void> => {
    const { blob, filename } = await quotesService.proposalBlob(quoteId);
    await saveOrShare(blob, filename, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  },

  /** Download the quote document (client-branded invoice, per the company's template). */
  downloadDocx: async (quoteId: string): Promise<void> => {
    const res = await authFetch(`${API_BASE}/${quoteId}/docx`, { headers: buildHeaders(false) });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const filename =
      res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "quote.docx";
    await saveOrShare(blob, filename, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  },
};

/** "<customer name> : <date time>" once a name is captured (PRD US2), else the date alone. */
export const quoteTitle = (
  quote: Pick<Quote, "createdAt"> & Partial<Pick<Quote, "customerName">>
): string => {
  const when = new Date(quote.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  });
  return quote.customerName ? `${quote.customerName} : ${when}` : when;
};

export const money = (v: number | null): string =>
  v == null ? "—" : `$${v.toFixed(2)}`;
