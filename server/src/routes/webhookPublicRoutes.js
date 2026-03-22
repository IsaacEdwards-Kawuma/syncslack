import { Router } from 'express';
import { incomingWebhook } from '../controllers/webhookIncomingController.js';

const r = Router();
r.post('/incoming/:token', incomingWebhook);

export default r;
