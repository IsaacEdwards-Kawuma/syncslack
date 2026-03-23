import { pool } from '../config/db.js';
import * as tasks from './tasks.js';
import * as workspaces from './workspaces.js';
import * as channels from './channels.js';
import * as conversations from './conversations.js';
import { isValidUuid } from '../utils/ids.js';

function normalizeMatch(s) {
  return String(s ?? '').trim();
}

export async function listAutomationRules(workspaceId, enabledOnly = true) {
  const ws = String(workspaceId);
  if (!isValidUuid(ws)) return [];
  const enabledSql = enabledOnly ? ' AND enabled = TRUE' : '';
  const { rows } = await pool.query(
    `SELECT id, workspace_id, created_by, enabled, match_phrase, scope_channel_id, task_assignee_user_id, task_due_in_minutes, created_at
     FROM message_automation_rules
     WHERE workspace_id = $1${enabledSql}
     ORDER BY created_at DESC`,
    [ws]
  );
  return rows;
}

export async function createAutomationRule({
  workspaceId,
  createdBy,
  matchPhrase,
  scopeChannelId = null,
  taskAssigneeUserId = null,
  taskDueInMinutes = null,
}) {
  const ws = String(workspaceId);
  const uid = String(createdBy);
  if (!isValidUuid(ws) || !isValidUuid(uid)) throw new Error('Invalid id');
  const phrase = normalizeMatch(matchPhrase);
  if (!phrase) throw new Error('matchPhrase required');

  let scope = null;
  if (scopeChannelId && isValidUuid(String(scopeChannelId))) scope = String(scopeChannelId);

  let assignee = null;
  if (taskAssigneeUserId && isValidUuid(String(taskAssigneeUserId))) assignee = String(taskAssigneeUserId);

  const due = taskDueInMinutes === null || taskDueInMinutes === undefined ? null : Number(taskDueInMinutes);
  if (due !== null && (!Number.isFinite(due) || due < 0)) throw new Error('Invalid taskDueInMinutes');

  // Ensure scope channel exists in workspace if provided.
  if (scope) {
    const ch = await channels.findChannelById(scope);
    if (!ch || String(ch.workspace_id) !== ws) throw new Error('Invalid scopeChannelId');
  }

  const r = await pool.query(
    `INSERT INTO message_automation_rules (workspace_id, created_by, enabled, match_phrase, scope_channel_id, task_assignee_user_id, task_due_in_minutes)
     VALUES ($1,$2,TRUE,$3,$4,$5,$6)
     RETURNING id, workspace_id, created_by, enabled, match_phrase, scope_channel_id, task_assignee_user_id, task_due_in_minutes, created_at`,
    [ws, uid, phrase, scope, assignee, due]
  );
  return r.rows[0];
}

export async function deleteAutomationRule(ruleId, userId, workspaceId) {
  const rid = String(ruleId);
  const uid = String(userId);
  const ws = String(workspaceId);
  if (!isValidUuid(rid) || !isValidUuid(uid) || !isValidUuid(ws)) throw new Error('Invalid id');

  // Only admins/owners can delete.
  const role = await workspaces.getMemberRole(ws, uid);
  if (role !== 'owner' && role !== 'admin') throw new Error('Not allowed');

  await pool.query(
    `DELETE FROM message_automation_rules WHERE id = $1 AND workspace_id = $2`,
    [rid, ws]
  );
  return { ok: true };
}

export async function runMessageAutomations({ workspaceId, messageId, actorUserId }) {
  const ws = String(workspaceId);
  const mid = String(messageId);
  const uid = String(actorUserId);
  if (!isValidUuid(ws) || !isValidUuid(mid) || !isValidUuid(uid)) return [];

  const rules = await listAutomationRules(ws, true);
  if (!rules.length) return [];

  const { rows } = await pool.query(
    `SELECT id, content, channel_id, conversation_id, deleted_at
     FROM messages
     WHERE id = $1`,
    [mid]
  );
  const msg = rows[0];
  if (!msg || msg.deleted_at) return [];

  const text = String(msg.content || '').toLowerCase();
  const createdTasks = [];
  for (const r of rules) {
    // Scope: channel-only for v1.
    if (r.scope_channel_id && String(msg.channel_id) !== String(r.scope_channel_id)) continue;
    const phrase = normalizeMatch(r.match_phrase).toLowerCase();
    if (!phrase) continue;
    if (!text.includes(phrase)) continue;

    const dueIso = r.task_due_in_minutes ? new Date(Date.now() + r.task_due_in_minutes * 60 * 1000).toISOString() : null;
    const task = await tasks.createTaskFromMessage({
      userId: uid,
      messageId: mid,
      dueAt: dueIso,
      assigneeUserId: r.task_assignee_user_id || null,
    }).catch(() => null);

    if (task) createdTasks.push(task);
  }

  return createdTasks;
}

