import { Router } from 'express';
import {
  createWorkspace,
  listMyWorkspaces,
  getWorkspace,
  getMemberProfile,
  joinWorkspace,
  joinByInvite,
  createWorkspaceInvite,
  searchWorkspace,
  getUnreadSummary,
  getThreadsInbox,
  updateWorkspaceMember,
  removeWorkspaceMember,
  listWorkspaceAudit,
  leaveWorkspace,
  transferWorkspaceOwnership,
} from '../controllers/workspaceController.js';
import { authMiddleware } from '../middleware/auth.js';

const r = Router();
r.use(authMiddleware);
r.post('/', createWorkspace);
r.get('/', listMyWorkspaces);
r.post('/join', joinWorkspace);
r.post('/join-invite', joinByInvite);
r.post('/:workspaceId/leave', leaveWorkspace);
r.post('/:workspaceId/transfer', transferWorkspaceOwnership);
r.get('/:workspaceId/unread-summary', getUnreadSummary);
r.get('/:workspaceId/threads/inbox', getThreadsInbox);
r.get('/:workspaceId/search', searchWorkspace);
r.post('/:workspaceId/invites', createWorkspaceInvite);
r.get('/:workspaceId/audit', listWorkspaceAudit);
r.patch('/:workspaceId/members/:memberUserId', updateWorkspaceMember);
r.delete('/:workspaceId/members/:memberUserId', removeWorkspaceMember);
r.get('/:workspaceId/members/:memberUserId/profile', getMemberProfile);
r.get('/:workspaceId', getWorkspace);

export default r;
