// Word lists used by the heuristic highlight scorer. Kept as plain data so
// they're easy to tune per-domain without touching scoring logic.

export const HOOK_WORDS = [
  "secret",
  "mistake",
  "truth",
  "never",
  "always",
  "huge",
  "incredible",
  "amazing",
  "surprising",
  "honestly",
  "actually",
  "problem",
  "solution",
  "biggest",
  "worst",
  "best",
  "important",
  "crazy",
  "shocking",
  "warning",
  "avoid",
  "why",
  "how",
];

export const FILLER_WORDS = [
  "um",
  "uh",
  "like",
  "you know",
  "sort of",
  "kind of",
  "basically",
  "literally",
  "i mean",
  "right",
];

export function countOccurrences(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  return words.reduce((count, word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = lower.match(new RegExp(`\\b${escaped}\\b`, "g"));
    return count + (matches?.length ?? 0);
  }, 0);
}
