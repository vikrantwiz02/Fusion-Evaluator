export function serializeModule(doc) {
  try {
    if (!doc?.id) {
      console.error('[serializeModule] Missing id:', doc);
      return null;
    }

    const obj = { ...doc };

    if (!Array.isArray(obj.groups)) obj.groups = [];
    if (!Array.isArray(obj.assigned_leads)) obj.assigned_leads = [];
    if (!Array.isArray(obj.divisions)) obj.divisions = [];

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
