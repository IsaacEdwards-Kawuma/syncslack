import * as tasks from '../db/tasks.js';

export async function createTaskFromMessage(req, res) {
  try {
    const { messageId } = req.params;
    const { dueInMinutes = null, dueAt = null, assigneeUserId = null } = req.body || {};

    let resolvedDueAt = null;
    if (dueAt) resolvedDueAt = new Date(dueAt);
    else if (typeof dueInMinutes === 'number' && dueInMinutes > 0) {
      resolvedDueAt = new Date(Date.now() + dueInMinutes * 60 * 1000);
    }

    const dueIso = resolvedDueAt ? resolvedDueAt.toISOString() : null;
    const task = await tasks.createTaskFromMessage({
      userId: req.user.sub,
      messageId,
      dueAt: dueIso,
      assigneeUserId,
    });
    return res.status(201).json({ task });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create task';
    if (msg === 'Not allowed') return res.status(403).json({ error: msg });
    return res.status(400).json({ error: msg });
  }
}

export async function listPriorityTasks(req, res) {
  try {
    const { workspaceId } = req.params;
    const { limit = 20 } = req.query || {};
    const tasksList = await tasks.listPriorityTasks(workspaceId, req.user.sub, Number(limit));
    return res.json({ tasks: tasksList });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load priority tasks' });
  }
}

export async function updateTaskStatus(req, res) {
  try {
    const { taskId } = req.params;
    const { status } = req.body || {};
    const task = await tasks.updateTaskStatus(taskId, req.user.sub, status);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    return res.json({ task });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update task';
    return res.status(400).json({ error: msg });
  }
}

