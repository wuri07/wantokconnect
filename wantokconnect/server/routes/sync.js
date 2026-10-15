import { Router } from 'express';
import { bad } from '../db.js';
import { requireAuth, wrap } from '../auth.js';
import { createPost, setReaction, setConnection } from './network.js';

export const sync = Router();

// Offline-first replay. The browser queues actions while offline and sends them here when signal returns.
// Each action has a UUID; replaying the same one twice never creates duplicates. retry=true means "keep it and try again later".
sync.post('/', requireAuth, wrap(async (req, res) => {
  const uid = req.user.id, actions = Array.isArray(req.body?.actions) ? req.body.actions.slice(0, 50) : [], results = [];
  for (const a of actions) {
    try {
      if (a.type === 'pro_post') await createPost(uid, { ...a.payload, client_uuid: a.id });
      else if (a.type === 'react') await setReaction(uid, a.payload?.post_id, a.payload?.kind, !!a.payload?.on);
      else if (a.type === 'connect') await setConnection(uid, a.payload?.user_id, !!a.payload?.on);
      else throw bad('Unknown action');
      results.push({ id: a.id, ok: true });
    } catch (e) { results.push({ id: a.id, ok: false, error: e.status ? e.message : 'Server error', retry: !e.status }); }
  }
  res.json({ results });
}));
