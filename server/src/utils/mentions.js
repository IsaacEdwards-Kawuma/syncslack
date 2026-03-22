/** Matches @uuid (v4) in message text for reliable mentions */
const UUID_RE = /@([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;

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
