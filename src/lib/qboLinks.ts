/**
 * Deep links into QuickBooks Online.
 *
 * The two hosts were verified by hand against a real posted estimate (2026-09-09). They are not
 * the hosts you would guess: Intuit's own console redirects to `app.qbo.intuit.com`, and most
 * integration snippets show `app.sandbox.qbo.intuit.com`, but the working transaction deep links
 * are the bare hosts below.
 *
 * `txnId` is `Quote.qboEstimateId` — the id QuickBooks returns when the estimate is posted.
 *
 * **No realm goes in the URL, and that is a real limitation.** The link opens the estimate in
 * whichever company the browser session happens to be signed into. There is no reliable way to
 * force a company switch, so a user signed into a different QuickBooks file will land on that
 * file's transaction with the same numeric id — a different document entirely. Callers must gate
 * the link on the company being *currently* connected; even then, a company that reconnected to a
 * different QuickBooks file has estimate ids that mean nothing there, because the quote never
 * records which realm its id came from (QBO-ARCHITECTURE.md §8, gap #9).
 */
export type QboEnvironment = "production" | "sandbox";

export function qboEstimateUrl(estimateId: string, environment: QboEnvironment): string {
  const host = environment === "sandbox" ? "sandbox.qbo.intuit.com" : "qbo.intuit.com";
  return `https://${host}/app/estimate?txnId=${encodeURIComponent(estimateId)}`;
}
