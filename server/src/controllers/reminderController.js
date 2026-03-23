import * as reminders from '../db/reminders.js';

export async function createReminderFromMessage(req, res) {
  try {
    const { messageId } = req.params;
    const { minutes } = req.body || {};
    if (typeof minutes !== 'number' || minutes <= 0) {
      return res.status(400).json({ error: 'minutes must be > 0' });
    }
    const runAt = new Date(Date.now() + minutes * 60 * 1000);
    const reminder = await reminders.createReminder({ userId: req.user.sub, messageId, runAt: runAt.toISOString() });
    return res.status(201).json({ reminder });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create reminder';
    if (msg === 'Not allowed') return res.status(403).json({ error: msg });
    return res.status(400).json({ error: msg });
  }
}

