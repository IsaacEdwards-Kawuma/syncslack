/** Expand first-line slash shortcuts (Slack-style). */
const MAP = {
  '/shrug': '¯\\_(ツ)_/¯',
  '/tableflip': '(╯°□°）╯︵ ┻━┻',
  '/tableback': '┬─┬ノ( º _ ºノ)',
};

export function applySlashExpansion(text) {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return text;
  const firstLine = trimmed.split('\n')[0].trim();
  const cmd = firstLine.split(/\s+/)[0].toLowerCase();
  if (MAP[cmd] !== undefined) {
    return text.replace(/^\s*/, '').replace(firstLine, MAP[cmd]);
  }
  return text;
}
