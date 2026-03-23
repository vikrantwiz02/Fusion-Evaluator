import mongoose from 'mongoose';
import Module from '../../../../lib/models/Module.js';
import { serializeModule } from '../../../../lib/utils/serializeModule.js';
import { canAccessModule, getRequestActor } from '../../../../lib/utils/moduleAccess.js';
import { canAccessTeamsModule } from '../../../../lib/utils/moduleAccess.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '200mb',
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

function normalizeSpecRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(row => row && typeof row === 'object' && !Array.isArray(row))
    .map(row => {
      const clean = {};
      for (const [key, value] of Object.entries(row)) {
        const k = String(key || '').trim();
        if (!k) continue;
        clean[k] = value == null ? '' : value;
      }
      return clean;
    });
}

function sanitizeZipPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const name = String(value.name || '').trim();
  const dataUrl = String(value.dataUrl || '').trim();
  if (!name || !dataUrl) {
    return null;
  }

  return {
    name,
    type: String(value.type || 'application/zip').trim() || 'application/zip',
    size: Number.isFinite(Number(value.size)) ? Number(value.size) : 0,
    uploadedAt: String(value.uploadedAt || '').trim() || new Date().toISOString(),
    dataUrl,
  };
}

function normalizeSpecLayoutWithZip(layout, existingLayout = {}) {
  const base = (layout && typeof layout === 'object' && !Array.isArray(layout))
    ? { ...layout }
    : { columnWidths: {}, rowHeights: {}, extraSections: [], sectionColumns: {} };

  const existingZip = sanitizeZipPayload(existingLayout?.moduleSpecsZip);
  const incomingZip = sanitizeZipPayload(base.moduleSpecsZip);

  if (incomingZip) {
    base.moduleSpecsZip = incomingZip;
  } else if (existingZip) {
    base.moduleSpecsZip = existingZip;
  } else {
    delete base.moduleSpecsZip;
  }

  return base;
}

// Simple connection handler
const mongooseReady = mongoose.connection.readyState === 1 
  ? Promise.resolve() 
  : mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 1,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Role, X-User-Email');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const actor = getRequestActor(req);

    await mongooseReady;
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable not set');
    }

    const queryId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const queryRest = req.query.rest ?? req.query['...rest'] ?? [];
    let path = Array.isArray(queryRest) ? queryRest : (queryRest ? [queryRest] : []);
    path = path
      .flatMap(segment => String(segment).split('/'))
      .map(segment => segment.trim())
      .filter(Boolean);

    const urlPath = (req.url || '').split('?')[0] || '';
    const marker = '/api/lab-manager/modules/';
    const urlSuffix = urlPath.includes(marker) ? urlPath.split(marker)[1] : '';
    const urlSegments = urlSuffix.split('/').filter(Boolean);
    const idFromUrl = urlSegments[0];
    const pathFromUrl = urlSegments.slice(1);

    const id = queryId || idFromUrl;
    if (!id) {
      return res.status(400).json({ error: 'Module id is required' });
    }

    // Fallback for runtimes where catch-all query params are not populated as expected.
    if (path.length === 0) {
      path = pathFromUrl;
    }

    // POST /api/lab-manager/modules/:id/duplicate
    if (req.method === 'POST' && path[0] === 'duplicate') {
      const original = await Module.findById(id);
      if (!original) return res.status(404).json({ error: 'Module not found' });
      if (!canAccessModule(original, actor)) {
        return res.status(403).json({ error: 'Access denied for this module' });
      }
      const data = original.toObject();
      delete data._id;
      delete data.createdAt;
      delete data.updatedAt;
      data.name = `${data.name} (Copy)`;
      data.groups = data.groups.map(g => {
        const ng = { ...g };
        delete ng._id;
        return ng;
      });
      const newMod = new Module(data);
      await newMod.save();
      const serialized = serializeModule(newMod);
      if (!serialized) {
        return res.status(500).json({ error: 'Failed to serialize duplicated module' });
      }
      return res.status(201).json(serialized);
    }

    // POST /api/lab-manager/modules/:id/groups
    if (req.method === 'POST' && path[0] === 'groups' && !path[1]) {
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
    }

    // PUT /api/lab-manager/modules/:id/groups/:groupId
    if (req.method === 'PUT' && path[0] === 'groups' && path[1] && !path[2]) {
      const mod = await Module.findById(id);
      if (!mod) return res.status(404).json({ error: 'Module not found' });
      if (!canAccessModule(mod, actor)) {
        return res.status(403).json({ error: 'Access denied for this module' });
      }
      const group = mod.groups.id(path[1]);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      Object.assign(group, req.body);
      // Mark group as modified
      const groupIndex = mod.groups.indexOf(group);
      mod.markModified(`groups.${groupIndex}`);
      await mod.save();
      return res.json({ success: true });
    }

    // DELETE /api/lab-manager/modules/:id/groups/:groupId
    if (req.method === 'DELETE' && path[0] === 'groups' && path[1]) {
      const mod = await Module.findById(id);
      if (!mod) return res.status(404).json({ error: 'Module not found' });
      if (!canAccessModule(mod, actor)) {
        return res.status(403).json({ error: 'Access denied for this module' });
      }
      mod.groups = mod.groups.filter(g => g._id.toString() !== path[1]);
      await mod.save();
      return res.json({ success: true });
    }

    // POST /api/lab-manager/modules/:id/groups/:groupId/duplicate
    if (req.method === 'POST' && path[0] === 'groups' && path[1] && path[2] === 'duplicate') {
      const mod = await Module.findById(id);
      if (!mod) return res.status(404).json({ error: 'Module not found' });
      if (!canAccessModule(mod, actor)) {
        return res.status(403).json({ error: 'Access denied for this module' });
      }
      const groupToCopy = mod.groups.id(path[1]);
      if (!groupToCopy) return res.status(404).json({ error: 'Group not found' });
      const copy = groupToCopy.toObject();
      delete copy._id;
      copy.pair_id = `${copy.pair_id} (Copy)`;
      mod.groups.push(copy);
      await mod.save();
      const saved = serializeModule(mod);
      if (!saved) {
        return res.status(500).json({ error: 'Failed to serialize module after duplicating group' });
      }
      const newGroup = saved.groups[saved.groups.length - 1];
      return res.status(201).json(newGroup);
    }

    // PUT /api/lab-manager/modules/:id/groups/:groupId/evaluation
    if (req.method === 'PUT' && path[0] === 'groups' && path[1] && path[2] === 'evaluation') {
      const mod = await Module.findById(id);
      if (!mod) return res.status(404).json({ error: 'Module not found' });
      if (!canAccessModule(mod, actor)) {
        return res.status(403).json({ error: 'Access denied for this module' });
      }
      const group = mod.groups.id(path[1]);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      
      // Merge the new evaluation data with existing
      const oldEval = group.evaluation?.toObject?.() ?? group.evaluation ?? {};
      const normalizedPayload = normalizeEvaluationPayload(req.body);

      group.evaluation = {
        ...oldEval,
        ...normalizedPayload,
      };
      
      // IMPORTANT: Mark nested object as modified for Mongoose to save it
      const groupIndex = mod.groups.indexOf(group);
      mod.markModified(`groups.${groupIndex}.evaluation`);
      
      try {
        await mod.save();
        return res.json({ success: true, evaluation: group.evaluation });
      } catch (saveErr) {
        return res.status(500).json({ error: 'Failed to save evaluation' });
      }
    }

    // POST /api/lab-manager/modules/:id/merge
    if (req.method === 'POST' && path[0] === 'merge') {
      const { poorPairId, highPairId } = req.body;
      const mod = await Module.findById(id);
      if (!mod) return res.status(404).json({ error: 'Module not found' });
      if (!canAccessModule(mod, actor)) {
        return res.status(403).json({ error: 'Access denied for this module' });
      }
      const poorGroup = mod.groups.find(g => g.pair_id === poorPairId);
      if (!poorGroup) return res.status(404).json({ error: 'Poor pair not found' });
      const highGroup = mod.groups.find(g => g.pair_id === highPairId);
      if (!highGroup) return res.status(404).json({ error: 'High pair not found' });

      poorGroup.is_merged = true;
      poorGroup.partner_pair_id = highPairId;
      highGroup.is_merged = true;
      highGroup.partner_pair_id = poorPairId;

      await mod.save();
      return res.json({ success: true });
    }

    // GET /api/lab-manager/modules/:id/specifications
    if (req.method === 'GET' && path[0] === 'specifications') {
      const mod = await Module.findById(id);
      if (!mod) return res.status(404).json({ error: 'Module not found' });
      if (!canAccessModule(mod, actor)) {
        return res.status(403).json({ error: 'Access denied for this module' });
      }

      return res.status(200).json({
        useCases: Array.isArray(mod.spec_use_cases) ? mod.spec_use_cases : [],
        workflows: Array.isArray(mod.spec_workflows) ? mod.spec_workflows : [],
        businessRules: Array.isArray(mod.spec_rules) ? mod.spec_rules : [],
        layout: mod.spec_layout && typeof mod.spec_layout === 'object' && !Array.isArray(mod.spec_layout)
          ? mod.spec_layout
          : { columnWidths: {}, rowHeights: {}, extraSections: [], sectionColumns: {} },
      });
    }

    // PUT /api/lab-manager/modules/:id/specifications
    if (req.method === 'PUT' && path[0] === 'specifications') {
      const mod = await Module.findById(id);
      if (!mod) return res.status(404).json({ error: 'Module not found' });
      if (!canAccessModule(mod, actor)) {
        return res.status(403).json({ error: 'Access denied for this module' });
      }

      if (path[1] === 'zip') {
        const nextZip = sanitizeZipPayload(req.body?.moduleSpecsZip);
        if (!nextZip) {
          return res.status(400).json({ error: 'moduleSpecsZip.name and moduleSpecsZip.dataUrl are required' });
        }

        mod.spec_layout = normalizeSpecLayoutWithZip(mod.spec_layout, mod.spec_layout);
        mod.spec_layout.moduleSpecsZip = nextZip;
        await mod.save();

        return res.status(200).json({
          success: true,
          layout: mod.spec_layout && typeof mod.spec_layout === 'object' && !Array.isArray(mod.spec_layout)
            ? mod.spec_layout
            : { columnWidths: {}, rowHeights: {}, extraSections: [], sectionColumns: {} },
        });
      }

      mod.spec_use_cases = normalizeSpecRows(req.body?.useCases);
      mod.spec_workflows = normalizeSpecRows(req.body?.workflows);
      mod.spec_rules = normalizeSpecRows(req.body?.businessRules);
      mod.spec_layout = normalizeSpecLayoutWithZip(req.body?.layout, mod.spec_layout);

      await mod.save();
      return res.status(200).json({
        success: true,
        useCases: Array.isArray(mod.spec_use_cases) ? mod.spec_use_cases : [],
        workflows: Array.isArray(mod.spec_workflows) ? mod.spec_workflows : [],
        businessRules: Array.isArray(mod.spec_rules) ? mod.spec_rules : [],
        layout: mod.spec_layout && typeof mod.spec_layout === 'object' && !Array.isArray(mod.spec_layout)
          ? mod.spec_layout
          : { columnWidths: {}, rowHeights: {}, extraSections: [], sectionColumns: {} },
      });
    }

    // GET /api/lab-manager/modules/:id/team-specifications
    if (req.method === 'GET' && path[0] === 'team-specifications') {
      const mod = await Module.findById(id);
      if (!mod) return res.status(404).json({ error: 'Module not found' });
      if (!(actor?.role === 'admin' || canAccessTeamsModule(mod, actor))) {
        return res.status(403).json({ error: 'Access denied for this module' });
      }

      return res.status(200).json({
        useCases: Array.isArray(mod.team_spec_use_cases) ? mod.team_spec_use_cases : [],
        workflows: Array.isArray(mod.team_spec_workflows) ? mod.team_spec_workflows : [],
        businessRules: Array.isArray(mod.team_spec_rules) ? mod.team_spec_rules : [],
        layout: mod.team_spec_layout && typeof mod.team_spec_layout === 'object' && !Array.isArray(mod.team_spec_layout)
          ? mod.team_spec_layout
          : { columnWidths: {}, rowHeights: {}, extraSections: [], sectionColumns: {} },
      });
    }

    // PUT /api/lab-manager/modules/:id/team-specifications
    if (req.method === 'PUT' && path[0] === 'team-specifications') {
      const mod = await Module.findById(id);
      if (!mod) return res.status(404).json({ error: 'Module not found' });
      if (!(actor?.role === 'admin' || canAccessTeamsModule(mod, actor))) {
        return res.status(403).json({ error: 'Access denied for this module' });
      }

      if (path[1] === 'zip') {
        const nextZip = sanitizeZipPayload(req.body?.moduleSpecsZip);
        if (!nextZip) {
          return res.status(400).json({ error: 'moduleSpecsZip.name and moduleSpecsZip.dataUrl are required' });
        }

        mod.team_spec_layout = normalizeSpecLayoutWithZip(mod.team_spec_layout, mod.team_spec_layout);
        mod.team_spec_layout.moduleSpecsZip = nextZip;
        await mod.save();

        return res.status(200).json({
          success: true,
          layout: mod.team_spec_layout && typeof mod.team_spec_layout === 'object' && !Array.isArray(mod.team_spec_layout)
            ? mod.team_spec_layout
            : { columnWidths: {}, rowHeights: {}, extraSections: [], sectionColumns: {} },
        });
      }

      mod.team_spec_use_cases = normalizeSpecRows(req.body?.useCases);
      mod.team_spec_workflows = normalizeSpecRows(req.body?.workflows);
      mod.team_spec_rules = normalizeSpecRows(req.body?.businessRules);
      mod.team_spec_layout = normalizeSpecLayoutWithZip(req.body?.layout, mod.team_spec_layout);

      await mod.save();
      return res.status(200).json({
        success: true,
        useCases: Array.isArray(mod.team_spec_use_cases) ? mod.team_spec_use_cases : [],
        workflows: Array.isArray(mod.team_spec_workflows) ? mod.team_spec_workflows : [],
        businessRules: Array.isArray(mod.team_spec_rules) ? mod.team_spec_rules : [],
        layout: mod.team_spec_layout && typeof mod.team_spec_layout === 'object' && !Array.isArray(mod.team_spec_layout)
          ? mod.team_spec_layout
          : { columnWidths: {}, rowHeights: {}, extraSections: [], sectionColumns: {} },
      });
    }

    res.status(404).json({ error: 'Route not found' });
  } catch (err) {
    console.error('[nested-routes] Request failed');
    res.status(500).json({ 
      error: 'Internal server error'
    });
  }
}
