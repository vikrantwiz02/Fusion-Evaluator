import mongoose from 'mongoose';
import Module from '../../../../lib/models/Module.js';
import { serializeModule } from '../../../../lib/utils/serializeModule.js';
import { canAccessModule, getRequestActor } from '../../../../lib/utils/moduleAccess.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const mongooseReady = mongoose.connection.readyState === 1
  ? Promise.resolve()
  : mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 1,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Role, X-User-Email');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const actor = getRequestActor(req);
    await mongooseReady;

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable not set');
    }

    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!id) {
      return res.status(400).json({ error: 'Module id is required' });
    }

    const mod = await Module.findById(id);
    if (!mod) return res.status(404).json({ error: 'Module not found' });
    if (!canAccessModule(mod, actor)) {
      return res.status(403).json({ error: 'Access denied for this module' });
    }

    mod.groups.push(req.body);
    await mod.save();

    const saved = serializeModule(mod);
    if (!saved) {
      return res.status(500).json({ error: 'Failed to serialize module after adding group' });
    }

    const newGroup = saved.groups[saved.groups.length - 1];
    return res.status(201).json(newGroup);
  } catch (err) {
    console.error('[groups] Request failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
