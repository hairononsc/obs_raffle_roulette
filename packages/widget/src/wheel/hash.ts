/**
 * FNV-1a hash mapped to [0, 1). Used to derive a deterministic "random"
 * landing jitter from the spinId: every widget instance (and any reload)
 * computes the exact same final pose for the same spin.
 */
export function hashToUnit(input: string): number {
  let hash = 0x811c9dc5;
  for (const char of input) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}
