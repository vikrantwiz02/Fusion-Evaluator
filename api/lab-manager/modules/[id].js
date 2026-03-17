import mongoose from 'mongoose';
import Module from '../../../lib/models/Module.js';
import { serializeModule } from '../../../lib/utils/serializeModule.js';
import { canAccessModule, getRequestActor } from '../../../lib/utils/moduleAccess.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

// Simple connection handler
const mongooseReady = mongoose.connection.readyState === 1 
  ? Promise.resolve() 
  : mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 1,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

function normalizeAssignedLeads(payload) {
  const assignedLeads = Array.isArray(payload.assigned_leads)
    ? payload.assigned_leads
    : [];

  return {
    ...payload,
    assigned_leads: assignedLeads
      .map(email => String(email).trim().toLowerCase())
      .filter(Boolean),
  };
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Role, X-User-Email');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { id } = req.query;

    await mongooseReady;

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable not set');
    }

    // GET /api/lab-manager/modules/:id
    if (req.method === 'GET') {
      const mod = await Module.findById(id);
      if (!mod) return res.status(404).json({ error: 'Module not found' });
      const actor = getRequestActor(req);
      if (!canAccessModule(mod, actor)) {
        return res.status(403).json({ error: 'Access denied for this module' });
      }
      const serialized = serializeModule(mod);
      if (!serialized) {
        return res.status(500).json({ error: 'Failed to serialize module data' });
      }
      return res.json(serialized);
    }

    // PUT /api/lab-manager/modules/:id
    if (req.method === 'PUT') {
      const mod = await Module.findByIdAndUpdate(
        id,
        normalizeAssignedLeads(req.body),
        { new: true, runValidators: true }
      );
      if (!mod) return res.status(404).json({ error: 'Module not found' });
      const serialized = serializeModule(mod);
      if (!serialized) {
        return res.status(500).json({ error: 'Failed to serialize module data' });
      }
      return res.json(serialized);
    }

    // DELETE /api/lab-manager/modules/:id
    if (req.method === 'DELETE') {
      await Module.findByIdAndDelete(id);
      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[module-id] Request failed');
    res.status(500).json({ 
      error: 'Internal server error'
    });
  }
}
