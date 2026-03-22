/**
 * Matches @uuid (v4) in message text for reliable mentions.
 * Use [0-9a-fA-F] so pasted uppercase UUIDs still match (JS `i` does not make character classes case-insensitive).
 */
const UUID_RE =
  /@([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89ab][0-9a-fA-F]{3}-[0-9a-fA-F]{12})/gi;

export function extractMentionedUserIds(content) {
  if (!content || typeof content !== 'string') return [];
  const ids = new Set();
  let m;
  const re = new RegExp(UUID_RE.source, 'gi');
  while ((m = re.exec(content)) !== null) {
    ids.add(m[1].toLowerCase());
  }
  return [...ids];
}
