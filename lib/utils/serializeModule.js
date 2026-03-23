export function serializeModule(doc) {
  try {
    if (!doc?.id) {
      console.error('[serializeModule] Missing id:', doc);
      return null;
    }

    const obj = { ...doc };

    if (!Array.isArray(obj.groups)) obj.groups = [];
    if (!Array.isArray(obj.assigned_leads)) obj.assigned_leads = [];
    if (!Array.isArray(obj.assigned_teams)) obj.assigned_teams = [];
    if (!Array.isArray(obj.divisions)) obj.divisions = [];
    if (!Array.isArray(obj.spec_use_cases)) obj.spec_use_cases = [];
    if (!Array.isArray(obj.spec_workflows)) obj.spec_workflows = [];
    if (!Array.isArray(obj.spec_rules)) obj.spec_rules = [];
    if (!obj.spec_layout || typeof obj.spec_layout !== 'object' || Array.isArray(obj.spec_layout)) obj.spec_layout = {};
    if (!Array.isArray(obj.team_spec_use_cases)) obj.team_spec_use_cases = [];
    if (!Array.isArray(obj.team_spec_workflows)) obj.team_spec_workflows = [];
    if (!Array.isArray(obj.team_spec_rules)) obj.team_spec_rules = [];
    if (!obj.team_spec_layout || typeof obj.team_spec_layout !== 'object' || Array.isArray(obj.team_spec_layout)) obj.team_spec_layout = {};

    const sanitizeLayoutForList = (layout) => {
      if (!layout || typeof layout !== 'object' || Array.isArray(layout)) return {};
      const next = { ...layout };

      // Remove temporary chunk-upload session data from API responses.
      if ('zip_upload' in next) {
        delete next.zip_upload;
      }

      // Keep metadata (name/type/size/uploadedAt) but drop heavy dataUrl from list/detail payloads.
      if (next.moduleSpecsZip && typeof next.moduleSpecsZip === 'object' && !Array.isArray(next.moduleSpecsZip)) {
        const { dataUrl: _dataUrl, ...zipMeta } = next.moduleSpecsZip;
        next.moduleSpecsZip = zipMeta;
      }

      return next;
    };

    obj.spec_layout = sanitizeLayoutForList(obj.spec_layout);
    obj.team_spec_layout = sanitizeLayoutForList(obj.team_spec_layout);

    obj.groups = obj.groups.map((group, idx) => {
      try {
        if (!group || typeof group !== 'object') return null;
        const g = { ...group };
        g.evaluation = (typeof g.evaluation === 'object' && g.evaluation !== null)
          ? g.evaluation
          : {};
        // Strip the nested relation object from the serialized group to keep payload lean
        delete g.division;
        return g;
      } catch (err) {
        console.error(`[serializeModule] Error processing group at index ${idx}:`, err);
        return null;
      }
    }).filter(Boolean);

    obj.divisions = obj.divisions.map((div, idx) => {
      try {
        if (!div || typeof div !== 'object') return null;
        // Strip the back-relation arrays (pairs) to avoid circular / duplicate data
        const { pairs: _pairs, module: _module, ...rest } = div;
        return rest;
      } catch (err) {
        console.error(`[serializeModule] Error processing division at index ${idx}:`, err);
        return null;
      }
    }).filter(Boolean);

    return obj;
  } catch (err) {
    console.error('[serializeModule] Error serializing:', err);
    return null;
  }
}
