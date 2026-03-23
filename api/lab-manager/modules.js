import mongoose from 'mongoose';
import Module from '../../lib/models/Module.js';
import { serializeModule } from '../../lib/utils/serializeModule.js';
import { getRequestActor } from '../../lib/utils/moduleAccess.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '200mb',
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

function normalizeAssignments(payload) {
  const assignedLeads = Array.isArray(payload.assigned_leads)
    ? payload.assigned_leads
    : [];
  const assignedTeams = Array.isArray(payload.assigned_teams)
    ? payload.assigned_teams
    : [];

  return {
    ...payload,
    assigned_leads: assignedLeads
      .map(email => String(email).trim().toLowerCase())
      .filter(Boolean),
    assigned_teams: assignedTeams
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
    // Ensure connection
    await mongooseReady;

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable not set');
    }

    // GET /api/lab-manager/modules
    if (req.method === 'GET') {
      const actor = getRequestActor(req);
      const scope = String(req.query?.scope || 'lead').trim().toLowerCase();
      let query = {};

      if (actor.role !== 'admin') {
        if (scope === 'teams') {
          query = { assigned_teams: { $in: [actor.email] } };
        } else if (scope === 'both') {
          query = {
            $or: [
              { assigned_leads: { $in: [actor.email] } },
              { assigned_teams: { $in: [actor.email] } },
            ],
          };
        } else {
          query = { assigned_leads: { $in: [actor.email] } };
        }
      }

      if (actor.role !== 'admin' && !actor.email) {
        return res.status(403).json({ error: 'User email is required' });
      }

      const modules = await Module.find(query).sort({ createdAt: 1 }).lean();
      const serialized = modules.map(serializeModule).filter(m => m !== null);
      return res.status(200).json(serialized);
    }

    // POST /api/lab-manager/modules
    if (req.method === 'POST') {
      const mod = new Module(normalizeAssignments(req.body));
      await mod.save();
      const serialized = serializeModule(mod);
      if (!serialized) {
        return res.status(500).json({ error: 'Failed to serialize created module' });
      }
      return res.status(201).json(serialized);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[modules] Request failed');
    res.status(500).json({ 
      error: 'Internal server error'
    });
  }
}
