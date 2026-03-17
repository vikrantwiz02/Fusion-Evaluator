import { loginWithGoogle } from '../services/auth.service.js';

export async function login(req, res) {
  const { credential } = req.body;
  if (!credential || typeof credential !== 'string') {
    return res.status(400).json({ error: 'credential is required' });
  }
  const user = await loginWithGoogle(credential);
  res.json(user);
}
