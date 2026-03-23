import * as automations from '../db/automations.js';
import * as workspaces from '../db/workspaces.js';

export async function listAutomations(req, res) {
  try {
    const { workspaceId } = req.params;
    if (!(await workspaces.isMember(workspaceId, req.user.sub))) return res.status(403).json({ error: 'Not a member' });
    const rules = await automations.listAutomationRules(workspaceId, false);
    return res.json({ rules });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to load automations' });
  }
}

export async function createAutomation(req, res) {
  try {
    const { workspaceId } = req.params;
    const { matchPhrase, scopeChannelId = null, taskAssigneeUserId = null, taskDueInMinutes = null } = req.body || {};
    const role = await workspaces.getMemberRole(workspaceId, req.user.sub);
    if (role !== 'owner' && role !== 'admin') return res.status(403).json({ error: 'Not allowed' });

    const rule = await automations.createAutomationRule({
      workspaceId,
      createdBy: req.user.sub,
      matchPhrase,
      scopeChannelId,
      taskAssigneeUserId,
      taskDueInMinutes,
    });
    return res.status(201).json({ rule });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create automation';
    return res.status(400).json({ error: msg });
  }
}

export async function deleteAutomation(req, res) {
  try {
    const { workspaceId, ruleId } = req.params;
    const role = await workspaces.getMemberRole(workspaceId, req.user.sub);
    if (role !== 'owner' && role !== 'admin') return res.status(403).json({ error: 'Not allowed' });
    await automations.deleteAutomationRule(ruleId, req.user.sub, workspaceId);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: 'Failed to delete automation' });
  }
}

