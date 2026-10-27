/**
 * Copilot client contract — mirrors the server's
 * src/copilot/orchestrator/responseContract.ts. The unified endpoint streams NAMED
 * SSE frames; the terminal `done` frame carries a `CopilotResponse` ({responseKind,
 * blocks}). Render each block by switching on `block.kind` — one component per kind.
 *
 * Source of truth: copilot-contract.ts at the repo root. Keep in sync.
 */

// ----- Estimate types (mirror of the server's estimate schema) -----

/**
 * Where a line's price came from. Prices are never invented, so a line is either priced
 * from the catalog / pricebook, awaiting a technician (`pending`), or human-`edited`.
 */
export type LineItemSource = "catalog" | "pricebook" | "pending" | "edited";

export interface EstimateLineItem {
  sourceSheet: string;
  /** Pricebook code, a catalog code, or the literal "PENDING" when unpriced. */
  code: string;
  description: string;
  kind: "material" | "service" | "labor" | "rental" | "permit" | "other";
  quantity: number;
  unit: string;
  /** null = awaiting a price. Render an editable blank, NOT $0. */
  unitPrice: number | null;
  lineTotal: number | null;
  isIdentifiedEquipment: boolean;
  priceStatus?: "priced" | "pending";
  source?: LineItemSource;
  // ----- present only on `source: "catalog"` lines -----
  productId?: string;
  /** Canonical www.homedepot.com link. Render this as an anchor. */
  link?: string;
  brand?: string;
  rating?: number;
  /** Pack size behind unitPrice — guards a 12-pack price reading as a unit price. */
  packageQuantity?: number;
  /** Pre-edit value, retained when source flips to "edited". */
  originalPrice?: number;
}

/** One selectable product for a line — the chosen item plus its alternates. */
export interface ProductOption {
  productId: string;
  title: string;
  brand?: string;
  price?: number;
  rating?: number;
  reviews?: number;
  link?: string;
  thumbnail?: string;
  availability?: string;
  selected?: boolean;
}

export interface Identification {
  brand: string;
  model: string;
  category: string;
  issue: string;
  decision: "repair" | "replace";
  confidence: number; // 0-1
}

export interface EstimateQuote {
  /** "needs_pricing" = itemised but line(s) await a price. Not signable. */
  status: "estimate" | "needs_info" | "needs_pricing";
  /** Lines with priceStatus "pending". Suppress a grand total while > 0. */
  pendingCount?: number;
  title: string;
  identifiedEquipment: Identification;
  lineItems: EstimateLineItem[];
  materialsServicesSubtotal: number;
  laborSubtotal: number;
  taxOther: number;
  total: number;
  currency: string;
  assumptions: string[];
  customerNotes: string[];
  // Present on a persisted quote turn:
  estimateNumber?: string | null;
  signed?: boolean;
  pdfKey?: string | null;
}

export interface FollowUpQuestionOption {
  id: string;
  label: string;
  value: string; // sent back as `content` when picked
}

export interface FollowUpQuestion {
  id: string;
  question: string;
  options: FollowUpQuestionOption[];
  allowOther: boolean; // always true — show an "Other" free-text/voice entry
}

/**
 * One answer already given to a clarifying question, persisted with the answering turn.
 *
 * Lets the question card show the selection permanently: the answer belongs on the card that
 * asked for it, not in a second bubble repeating every question and answer back to the user.
 */
export interface QuestionAnswer {
  /** Matches FollowUpQuestion.id. */
  questionId: string;
  question: string;
  value: string;
  /** True when typed into the "Other" box rather than picked from the options. */
  fromOther?: boolean;
}

// ----- Block contract -----
export interface CitationItem {
  standard?: string; // e.g. "NFPA"
  code?: string; // e.g. "25"
  section?: string;
  title: string;
  url?: string;
}

export interface SourceItem {
  type: "file" | "web";
  title: string;
  fileId?: string;
  url?: string;
}

export interface FollowUpChip {
  id: string;
  prompt: string; // POST this as the next `content`
  label: string;
}

export type CopilotActionType = "preview_estimate" | "sign_estimate" | "email_estimate" | "download_pdf";
export interface ActionItem {
  id: string;
  label: string;
  actionType: CopilotActionType;
  endpoint: string; // call this — do NOT send a chat message
  method: "POST" | "GET";
  style?: "primary" | "secondary";
}

export type CopilotBlock =
  | { kind: "markdown"; text: string }
  | { kind: "citations"; items: CitationItem[] }
  | { kind: "sources"; items: SourceItem[] }
  | { kind: "identified"; data: Identification }
  | { kind: "quote"; data: EstimateQuote }
  | { kind: "questions"; data: { questions: FollowUpQuestion[] } }
  | { kind: "followUps"; items: FollowUpChip[] }
  | { kind: "actions"; items: ActionItem[] }
  /** Catalog products for a quote line: the chosen item plus selectable alternates. */
  | { kind: "products"; lineCode: string; items: ProductOption[] };

export type CopilotResponseKind = "message" | "quote" | "questions";

export interface CopilotResponse {
  responseKind: CopilotResponseKind;
  blocks: CopilotBlock[];
}
