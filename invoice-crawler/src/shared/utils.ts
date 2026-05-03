/**
 * Shared utilities used by both main and renderer processes.
 * Pure functions only — no Node or browser APIs.
 */

/** Lowercase, underscore-separated slug suitable for CSV column keys. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/**
 * Compact, human-readable ID with a prefix. Suitable for client-side IDs
 * (field rows, batch runs) where collision risk is negligible. Use Node's
 * `crypto.randomUUID()` in the main process for persisted record IDs.
 */
export function shortId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Cross-platform path basename. Renderer can't import Node's `path`. */
export function basenameOf(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}
