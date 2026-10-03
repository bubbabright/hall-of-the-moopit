export const CIPHER_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
export const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
export const HANDLE_RE = /^[A-Za-z0-9][A-Za-z0-9 '\-]{0,15}$/;
export const GAME_ID_RE = /^[a-z][a-z0-9-]{1,31}$/;
export const MODE_RE = /^[a-z0-9-]{1,32}$/;

/** Same derivation GEMFALL uses — keep this stable forever. */
export function deriveCipher(playerId: string): string {
  const hex = playerId
    .replace(/-/g, "")
    .replace(/[^A-Za-z0-9]/g, "0")
    .slice(0, 8)
    .toUpperCase()
    .padEnd(8, "0");
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export function sanitizeHandle(raw: unknown): string {
  const trimmed = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
  return HANDLE_RE.test(trimmed) ? trimmed : "";
}
