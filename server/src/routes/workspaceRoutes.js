import { Router } from 'express';
import {
  createWorkspace,
  listMyWorkspaces,
  getWorkspace,
  joinWorkspace,
} from '../controllers/workspaceController.js';
import { authMiddleware } from '../middleware/auth.js';

const r = Router();
r.use(authMiddleware);
r.post('/', createWorkspace);
r.get('/', listMyWorkspaces);
r.post('/join', joinWorkspace);
r.get('/:workspaceId', getWorkspace);

export default r;
