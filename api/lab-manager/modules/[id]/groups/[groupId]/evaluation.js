import mongoose from 'mongoose';
import Module from '../../../../../../lib/models/Module.js';
import { canAccessModule, getRequestActor } from '../../../../../../lib/utils/moduleAccess.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

function encodeMongoKey(key) {
  return String(key)
    .replace(/\$/g, '__DOLLAR__')
    .replace(/\./g, '__DOT__');
}

function encodeFileMapKeys(fileMap) {
  if (!fileMap || typeof fileMap !== 'object') return {};
  return Object.fromEntries(
    Object.entries(fileMap).map(([k, v]) => [encodeMongoKey(k), v])
  );
}

function normalizeEvaluationPayload(payload) {
  const normalized = { ...(payload || {}) };
  if (normalized.backend?.files && typeof normalized.backend.files === 'object') {
    normalized.backend = {
      ...normalized.backend,
      files: encodeFileMapKeys(normalized.backend.files),
    };
  }
  if (normalized.frontend?.files && typeof normalized.frontend.files === 'object') {
    normalized.frontend = {
      ...normalized.frontend,
      files: encodeFileMapKeys(normalized.frontend.files),
    };
  }
  return normalized;
}

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

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const actor = getRequestActor(req);
    await mongooseReady;

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable not set');
    }

    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const groupId = Array.isArray(req.query.groupId) ? req.query.groupId[0] : req.query.groupId;

    if (!id || !groupId) {
      return res.status(400).json({ error: 'Module id and group id are required' });
    }

    const mod = await Module.findById(id);
    if (!mod) return res.status(404).json({ error: 'Module not found' });
    if (!canAccessModule(mod, actor)) {
      return res.status(403).json({ error: 'Access denied for this module' });
    }

    const group = mod.groups.id(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const oldEval = group.evaluation?.toObject?.() ?? group.evaluation ?? {};
    const normalizedPayload = normalizeEvaluationPayload(req.body);

    group.evaluation = {
      ...oldEval,
      ...normalizedPayload,
    };

    const groupIndex = mod.groups.indexOf(group);
    mod.markModified(`groups.${groupIndex}.evaluation`);

    await mod.save();
    return res.json({ success: true, evaluation: group.evaluation });
  } catch (err) {
    console.error('[groups-evaluation] Request failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
