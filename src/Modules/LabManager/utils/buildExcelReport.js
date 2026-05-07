import * as XLSX from 'xlsx';

function yesNo(val) {
  if (val == null) return '—';
  return val ? 'Yes' : 'No';
}

function stripHtml(value) {
  // Keep numbers/booleans as-is so Excel treats them as the right type
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const text = String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Re-parse back to number if the stripped text is a valid finite number
  const n = Number(text);
  if (text !== '' && Number.isFinite(n)) return n;
  return text;
}

function addSheet(wb, rows, sheetName, colWidths) {
  let ws;
  if (rows.length > 0) {
    ws = XLSX.utils.json_to_sheet(rows);
  } else {
    const headers = colWidths.map((_, i) => `Column ${i + 1}`);
    ws = XLSX.utils.aoa_to_sheet([headers]);
  }
  ws['!cols'] = colWidths;
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
}

// Collect all column names from rows, respecting preferred order
function buildColumns(rows, preferred = []) {
  const discovered = [];
  (rows || []).forEach(row => {
    Object.keys(row || {}).forEach(k => {
      const key = String(k || '').trim();
      if (key && !discovered.includes(key)) discovered.push(key);
    });
  });
  const ordered = [];
  preferred.forEach(col => {
    const c = String(col || '').trim();
    if (c && discovered.includes(c) && !ordered.includes(c)) ordered.push(c);
  });
  discovered.forEach(col => {
    if (!ordered.includes(col)) ordered.push(col);
  });
  return ordered;
}

// Build col widths array from column names (auto-size by header length + padding)
function autoColWidths(columns, extraWch = 6) {
  return columns.map(col => ({ wch: Math.min(50, Math.max(10, col.length + extraWch)) }));
}

function addSpecSheet(wb, modName, rows, preferredColumns, sheetName) {
  const allColumns = buildColumns(rows, preferredColumns);
  if (allColumns.length === 0) return;

  // Build normalized rows: prefix with Module column, strip HTML from values
  const normalizedRows = rows.map(row => {
    const out = { 'Module': modName };
    allColumns.forEach(col => {
      out[col] = stripHtml(row?.[col] ?? '');
    });
    return out;
  });

  const colWidths = [{ wch: 24 }, ...autoColWidths(allColumns)];

  let ws;
  if (normalizedRows.length > 0) {
    ws = XLSX.utils.json_to_sheet(normalizedRows);
  } else {
    ws = XLSX.utils.aoa_to_sheet([['Module', ...allColumns]]);
  }
  ws['!cols'] = colWidths;
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  // Truncate sheet name to 31 chars (Excel limit)
  const safeName = sheetName.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeName);
}

export function buildExcelReport(modules) {
  const wb = XLSX.utils.book_new();

  const summaryRows = [];
  const featureRows = [];
  const beFileRows  = [];
  const feFileRows  = [];
  const statsRows   = [];

  // Spec section accumulation: { sheetName -> { rows, preferredColumns } }
  const specSections = {
    'Use Cases':       { rows: [], preferredColumns: [] },
    'Business Rules':  { rows: [], preferredColumns: [] },
    'Workflows':       { rows: [], preferredColumns: [] },
  };
  // Extra dynamic sections: Map<label -> { rows, preferredColumns }>
  const extraSectionMap = new Map();

  for (const mod of (modules || [])) {
    const divMap = Object.fromEntries(
      (mod.divisions || []).map(d => [d.id, d.name])
    );

    // ── Spec sheets ───────────────────────────────────────────────
    const layout = (mod.spec_layout && typeof mod.spec_layout === 'object') ? mod.spec_layout : {};
    const sectionColumns = (layout.sectionColumns && typeof layout.sectionColumns === 'object') ? layout.sectionColumns : {};

    // Collect preferred column order from the module-level template
    const templateSpecMap = {
      'Use Cases':      { preferred: sectionColumns.useCases       || [] },
      'Business Rules': { preferred: sectionColumns.businessRules  || [] },
      'Workflows':      { preferred: sectionColumns.workflows      || [] },
    };
    for (const [sectionName, { preferred }] of Object.entries(templateSpecMap)) {
      const section = specSections[sectionName];
      preferred.forEach(col => {
        const c = String(col || '').trim();
        if (c && !section.preferredColumns.includes(c)) section.preferredColumns.push(c);
      });
    }

    // Extra sections from spec_layout.extraSections — collect preferred columns only
    const extraSections = Array.isArray(layout.extraSections) ? layout.extraSections : [];
    for (const extra of extraSections) {
      if (!extra?.key || !extra?.label) continue;
      const label = String(extra.label).trim();
      if (!extraSectionMap.has(label)) {
        extraSectionMap.set(label, { rows: [], preferredColumns: [] });
      }
      const bucket = extraSectionMap.get(label);
      const preferred = Array.isArray(extra.columns) ? extra.columns : [];
      preferred.forEach(col => {
        const c = String(col || '').trim();
        if (c && !bucket.preferredColumns.includes(c)) bucket.preferredColumns.push(c);
      });
    }

    // ── Evaluation data ───────────────────────────────────────────
    let modFunctional = 0, modTotal = 0, modFeaturesDone = 0, modFeaturesTotal = 0;

    for (const g of (mod.groups || [])) {
      const ev       = (g.evaluation && typeof g.evaluation === 'object') ? g.evaluation : {};
      const be       = (ev.backend   && typeof ev.backend   === 'object') ? ev.backend   : {};
      const fe       = (ev.frontend  && typeof ev.frontend  === 'object') ? ev.frontend  : {};
      const div      = g.division_id ? (divMap[g.division_id] || '—') : '—';
      const beFiles  = Object.entries(be.files  || {});
      const feFiles  = Object.entries(fe.files  || {});
      const features = Array.isArray(ev.features) ? ev.features : [];

      // ── Per-pair spec rows (has filled Score/Evidence/etc.) ──────
      const pairModSpec = (ev.module_specifications && typeof ev.module_specifications === 'object')
        ? ev.module_specifications : {};

      const pairSpecMap = {
        'Use Cases':      Array.isArray(pairModSpec.useCases)      ? pairModSpec.useCases      : [],
        'Business Rules': Array.isArray(pairModSpec.businessRules) ? pairModSpec.businessRules : [],
        'Workflows':      Array.isArray(pairModSpec.workflows)      ? pairModSpec.workflows      : [],
      };

      for (const [sectionName, rows] of Object.entries(pairSpecMap)) {
        const section = specSections[sectionName];
        rows.forEach(row => {
          if (!row || typeof row !== 'object') return;
          const cleaned = { 'Module': mod.name || '', 'Division': div, 'Pair': g.pair_id || '' };
          Object.entries(row).forEach(([k, v]) => {
            const key = String(k || '').trim();
            if (key) cleaned[key] = stripHtml(v);
          });
          section.rows.push(cleaned);
        });
      }

      // Extra dynamic sections — per-pair
      const extraPairSections = Array.isArray(pairModSpec.extraSections) ? pairModSpec.extraSections : [];
      for (const extra of extraPairSections) {
        if (!extra?.label) continue;
        const label = String(extra.label).trim();
        if (!extraSectionMap.has(label)) {
          extraSectionMap.set(label, { rows: [], preferredColumns: [] });
        }
        const bucket = extraSectionMap.get(label);
        const rows = Array.isArray(extra.rows) ? extra.rows : [];
        rows.forEach(row => {
          if (!row || typeof row !== 'object') return;
          const cleaned = { 'Module': mod.name || '', 'Division': div, 'Pair': g.pair_id || '' };
          Object.entries(row).forEach(([k, v]) => {
            const key = String(k || '').trim();
            if (key) cleaned[key] = stripHtml(v);
          });
          bucket.rows.push(cleaned);
        });
      }

      modTotal++;
      if (ev.is_functional) modFunctional++;
      modFeaturesDone  += features.filter(f => f.is_functional).length;
      modFeaturesTotal += features.length;

      // ── Sheet 1: Summary ─────────────────────────────────────────
      summaryRows.push({
        'Module':              mod.name || '',
        'Date':                mod.date  || '—',
        'Division':            div,
        'Pair ID':             g.pair_id || '',
        'Category':            g.category || 'CONV',
        'Domain Leads':        (g.domain_leads || []).join(', ') || '—',
        'Roll Numbers':        (g.roll_numbers || []).join(', ') || '—',
        'Overall Functional':  yesNo(ev.is_functional),
        'BE Files Done':       beFiles.filter(([, v]) => v).length,
        'BE Files Total':      beFiles.length,
        'BE Endpoints':        (be.endpoints || []).length,
        'BE Functions':        (be.functions  || []).length,
        'BE Arch Match':       yesNo(be.architecture_matches_reference),
        'BE Arch Note':        be.architecture_note || '',
        'FE Files Done':       feFiles.filter(([, v]) => v).length,
        'FE Files Total':      feFiles.length,
        'FE Endpoints Used':   (fe.endpoints_used || []).length,
        'UI/UX Match':         yesNo(fe.ui_ux_matches_fusion_erp),
        'FE Arch Match':       yesNo(fe.architecture_matches_reference),
        'FE Arch Note':        fe.architecture_note || '',
        'Features Functional': features.filter(f => f.is_functional).length,
        'Features Total':      features.length,
        'Notes':               ev.notes || '',
      });

      // ── Sheet 2: Features ────────────────────────────────────────
      features.forEach((f, i) => {
        featureRows.push({
          'Module':       mod.name || '',
          'Division':     div,
          'Pair ID':      g.pair_id || '',
          'Feature #':    i + 1,
          'Feature Name': f.name || '',
          'Has Backend':  yesNo(f.backend),
          'Has Frontend': yesNo(f.frontend),
          'Functional':   yesNo(f.is_functional),
        });
      });

      // ── Sheet 3: Backend Files ───────────────────────────────────
      beFiles.forEach(([name, done]) => {
        beFileRows.push({
          'Module':    mod.name || '',
          'Division':  div,
          'Pair ID':   g.pair_id || '',
          'File Name': name,
          'Status':    done ? '✓' : '✗',
        });
      });

      // ── Sheet 4: Frontend Files ──────────────────────────────────
      feFiles.forEach(([name, done]) => {
        feFileRows.push({
          'Module':    mod.name || '',
          'Division':  div,
          'Pair ID':   g.pair_id || '',
          'File Name': name,
          'Status':    done ? '✓' : '✗',
        });
      });
    }

    // ── Statistics row per module ─────────────────────────────────
    const useCaseCount  = (mod.spec_use_cases  || []).length;
    const workflowCount = (mod.spec_workflows   || []).length;
    const ruleCount     = (mod.spec_rules       || []).length;

    // Scores from per-pair evaluation use cases (has filled Score values)
    const allEvalUcRows = (mod.groups || []).flatMap(g => {
      const ms = g.evaluation?.module_specifications;
      return Array.isArray(ms?.useCases) ? ms.useCases : [];
    });
    const scoreSource = allEvalUcRows.length > 0 ? allEvalUcRows : (mod.spec_use_cases || []);
    const scoreValues = scoreSource
      .map(row => {
        const key = Object.keys(row || {}).find(k =>
          /score/i.test(String(k || ''))
        );
        return key ? Number(stripHtml(row[key])) : NaN;
      })
      .filter(n => !isNaN(n) && n >= 0);

    const totalScore   = scoreValues.reduce((s, n) => s + n, 0);
    const maxScore     = scoreValues.length * 3; // Score(0-3) per use case
    const avgScore     = scoreValues.length > 0 ? (totalScore / scoreValues.length).toFixed(2) : '—';

    statsRows.push({
      'Module':                  mod.name || '',
      'Date':                    mod.date  || '—',
      'Total Pairs':             modTotal,
      'Functional Pairs':        modFunctional,
      'Non-Functional Pairs':    modTotal - modFunctional,
      'Functional %':            modTotal > 0 ? ((modFunctional / modTotal) * 100).toFixed(1) + '%' : '—',
      'Total Features':          modFeaturesTotal,
      'Functional Features':     modFeaturesDone,
      'Feature Completion %':    modFeaturesTotal > 0 ? ((modFeaturesDone / modFeaturesTotal) * 100).toFixed(1) + '%' : '—',
      'Use Case Count':          useCaseCount,
      'Workflow Count':          workflowCount,
      'Business Rule Count':     ruleCount,
      'Use Case Total Score':    scoreValues.length > 0 ? totalScore : '—',
      'Use Case Max Score':      scoreValues.length > 0 ? maxScore : '—',
      'Use Case Avg Score':      avgScore,
    });
  }

  // ── Write sheets ──────────────────────────────────────────────────
  addSheet(wb, summaryRows, 'Summary', [
    { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 },
    { wch: 30 }, { wch: 30 }, { wch: 18 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 32 },
    { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 32 },
    { wch: 20 }, { wch: 15 }, { wch: 40 },
  ]);

  addSheet(wb, featureRows, 'Features', [
    { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 36 },
    { wch: 14 }, { wch: 14 }, { wch: 12 },
  ]);

  addSheet(wb, beFileRows, 'Backend Files', [
    { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 36 }, { wch: 10 },
  ]);

  addSheet(wb, feFileRows, 'Frontend Files', [
    { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 36 }, { wch: 10 },
  ]);

  // ── Spec sheets ───────────────────────────────────────────────────
  for (const [sheetName, { rows, preferredColumns }] of Object.entries(specSections)) {
    if (rows.length === 0 && preferredColumns.length === 0) continue;
    const restCols = preferredColumns.filter(c => c !== 'S.No.' && c !== 'Pair' && c !== 'Division');
    const allCols = buildColumns(rows, ['Module', 'S.No.', 'Pair', ...restCols, 'Division']);
    const colWidths = allCols.map(col => ({ wch: Math.min(50, Math.max(12, col.length + 6)) }));
    let ws;
    if (rows.length > 0) {
      // Re-order rows to match discovered column order
      const orderedRows = rows.map(row => {
        const out = {};
        allCols.forEach(col => { out[col] = row[col] ?? ''; });
        return out;
      });
      ws = XLSX.utils.json_to_sheet(orderedRows);
    } else {
      ws = XLSX.utils.aoa_to_sheet([allCols]);
    }
    ws['!cols'] = colWidths;
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // Extra dynamic spec sections
  for (const [label, { rows, preferredColumns }] of extraSectionMap) {
    if (rows.length === 0 && preferredColumns.length === 0) continue;
    const restCols = preferredColumns.filter(c => c !== 'S.No.' && c !== 'Pair' && c !== 'Division');
    const allCols = buildColumns(rows, ['Module', 'S.No.', 'Pair', ...restCols, 'Division']);
    const colWidths = allCols.map(col => ({ wch: Math.min(50, Math.max(12, col.length + 6)) }));
    let ws;
    if (rows.length > 0) {
      const orderedRows = rows.map(row => {
        const out = {};
        allCols.forEach(col => { out[col] = row[col] ?? ''; });
        return out;
      });
      ws = XLSX.utils.json_to_sheet(orderedRows);
    } else {
      ws = XLSX.utils.aoa_to_sheet([allCols]);
    }
    ws['!cols'] = colWidths;
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31));
  }

  // ── Statistics sheet (data for charts) ───────────────────────────
  addSheet(wb, statsRows, 'Statistics', [
    { wch: 28 }, { wch: 12 },
    { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 16 },
    { wch: 16 }, { wch: 20 }, { wch: 20 },
    { wch: 16 }, { wch: 16 }, { wch: 20 },
    { wch: 22 }, { wch: 20 }, { wch: 20 },
  ]);

  return wb;
}

export function downloadExcelReport(modules, filename = 'evaluation_report.xlsx') {
  const wb = buildExcelReport(modules);
  XLSX.writeFile(wb, filename);
}
