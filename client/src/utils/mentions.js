/**
 * UUID v4 after @ — must match server/src/utils/mentions.js (case-insensitive hex).
 */
export const MENTION_UUID_RE =
  /@([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89ab][0-9a-fA-F]{3}-[0-9a-fA-F]{12})/gi;

const FULL_UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89ab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

/**
 * Active @mention token for composer: typing @name or @partial-uuid opens the picker;
 * completed @uuid closes it.
 */
export function getMentionContext(value) {
  if (!value || typeof value !== 'string') {
    return { open: false, filter: '', replaceStart: -1, replaceEnd: -1 };
  }
  const lastAt = value.lastIndexOf('@');
  if (lastAt === -1) return { open: false, filter: '', replaceStart: -1, replaceEnd: -1 };
  const after = value.slice(lastAt + 1);
  if (after[0] === ' ') return { open: false, filter: '', replaceStart: -1, replaceEnd: -1 };
  const nl = after.indexOf('\n');
  const line = nl === -1 ? after : after.slice(0, nl);
  const m = line.match(/^[^\s\n]*/);
  const token = m ? m[0] : '';
  if (FULL_UUID_RE.test(token)) return { open: false, filter: '', replaceStart: -1, replaceEnd: -1 };
  return {
    open: true,
    filter: token.toLowerCase(),
    replaceStart: lastAt,
    replaceEnd: lastAt + 1 + token.length,
  };
}

/**
 * Turn @uuid into markdown links so ReactMarkdown can render styled mentions.
 */
export function mentionsToMarkdownLinks(content, members) {
  if (!content || typeof content !== 'string') return content;
  const map = new Map((members || []).map((m) => [String(m.id).toLowerCase(), m]));
  return content.replace(MENTION_UUID_RE, (full, id) => {
    const m = map.get(id.toLowerCase());
    const label = m ? m.name.replace(/[\[\]]/g, '') : `${id.slice(0, 8)}…`;
    return `[${label}](mention:${id})`;
  });
}
