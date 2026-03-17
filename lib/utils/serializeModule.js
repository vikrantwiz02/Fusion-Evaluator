export function serializeModule(doc) {
  try {
    if (!doc?.id) {
      console.error('[serializeModule] Missing id:', doc);
      return null;
    }

    const obj = { ...doc };

    if (!Array.isArray(obj.groups)) obj.groups = [];
    if (!Array.isArray(obj.assigned_leads)) obj.assigned_leads = [];

    obj.groups = obj.groups.map((group, idx) => {
      try {
        if (!group || typeof group !== 'object') return null;
        const g = { ...group };
        g.evaluation = (typeof g.evaluation === 'object' && g.evaluation !== null)
          ? g.evaluation
          : {};
        return g;
      } catch (err) {
        console.error(`[serializeModule] Error processing group at index ${idx}:`, err);
        return null;
      }
    }).filter(Boolean);

    return obj;
  } catch (err) {
    console.error('[serializeModule] Error serializing:', err);
    return null;
  }
}
