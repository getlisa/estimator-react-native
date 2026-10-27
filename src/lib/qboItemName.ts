/**
 * What auto-resolution will call the QuickBooks item for a line, when the technician has not
 * picked one explicitly.
 *
 * Mirrors the server's own derivation so the dropdown's "Auto — will create X" is not a guess:
 * labor always bills to a single "Labor" item, and a material prefers the catalog-shaped
 * `searchTerm` the agent produced over the free-text description it came from. Intuit caps an item
 * name at 100 characters, so the slice happens here rather than being discovered at post time.
 */
export const qboAutoItemName = (isLabor: boolean, primary: string | null, fallback: string) =>
  (isLabor ? "Labor" : primary?.trim() || fallback).slice(0, 100);
