import { Router } from 'express';
import {
  createWorkspace,
  listMyWorkspaces,
  getWorkspace,
  joinWorkspace,
  joinByInvite,
  createWorkspaceInvite,
  searchWorkspace,
  updateWorkspaceMember,
  removeWorkspaceMember,
  listWorkspaceAudit,
} from '../controllers/workspaceController.js';
import { authMiddleware } from '../middleware/auth.js';

const r = Router();
r.use(authMiddleware);
r.post('/', createWorkspace);
r.get('/', listMyWorkspaces);
r.post('/join', joinWorkspace);
r.post('/join-invite', joinByInvite);
r.get('/:workspaceId/search', searchWorkspace);
r.post('/:workspaceId/invites', createWorkspaceInvite);
r.get('/:workspaceId/audit', listWorkspaceAudit);
r.patch('/:workspaceId/members/:memberUserId', updateWorkspaceMember);
r.delete('/:workspaceId/members/:memberUserId', removeWorkspaceMember);
r.get('/:workspaceId', getWorkspace);

export default r;
