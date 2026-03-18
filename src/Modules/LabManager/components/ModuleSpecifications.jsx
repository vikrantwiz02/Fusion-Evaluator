import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Underline as UnderlineIcon, Upload, Save, Plus, FileSpreadsheet, Columns3, Trash2 } from 'lucide-react';
import { saveModuleSpecifications } from '../api';

const BASE_SECTIONS = [
  { key: 'useCases', label: 'Use Cases' },
  { key: 'workflows', label: 'Workflows' },
  { key: 'businessRules', label: 'Business Rules' },
];

const DEFAULT_SERIAL_COLUMN = 'S.No.';
const SERIAL_ALIASES = ['s.no.', 's.no', 'sno', 'sr.no', 'sr no', 'serial no', 'serial_no', 's_no'];

function normalizeColumnName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isSerialColumnName(value) {
  return SERIAL_ALIASES.includes(normalizeColumnName(value));
}

function findSerialColumn(columns = []) {
  return columns.find(col => isSerialColumnName(col)) || null;
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLegacyPlaceholderRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  const entries = Object.entries(row)
    .map(([k, v]) => [String(k || '').trim(), stripHtml(v).toLowerCase()])
    .filter(([k]) => k.length > 0);

  if (entries.length !== 1) return false;
  const [key, value] = entries[0];
  const normalizedKey = key.toLowerCase();

  return (normalizedKey === 'header' || normalizedKey === 'column 1') && value === 'ok';
}

function sanitizeIncomingRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(row => row && typeof row === 'object' && !Array.isArray(row))
    .filter(row => !isLegacyPlaceholderRow(row));
}

function withAutoSerial(rows) {
  const cleanRows = sanitizeIncomingRows(rows).map(row => ({ ...row }));
  const allColumns = Array.from(
    new Set(cleanRows.flatMap(row => Object.keys(row || {}).map(key => String(key || '').trim()).filter(Boolean)))
  );

  const serialColumn = findSerialColumn(allColumns) || DEFAULT_SERIAL_COLUMN;

  return cleanRows.map((row, index) => {
    const next = { ...row };
    if (next[serialColumn] === undefined || String(next[serialColumn]).trim() === '') {
      next[serialColumn] = String(index + 1);
    }
    return next;
  });
}

function collectColumns(rows) {
  const cols = [];
  (rows || []).forEach(row => {
    Object.keys(row || {}).forEach(key => {
      const k = String(key || '').trim();
      if (k && !cols.includes(k)) cols.push(k);
    });
  });
  return cols;
}

function orderColumns(discovered = [], preferred = []) {
  const ordered = [];

  preferred.forEach(col => {
    const c = String(col || '').trim();
    if (c && discovered.includes(c) && !ordered.includes(c)) ordered.push(c);
  });

  discovered.forEach(col => {
    const c = String(col || '').trim();
    if (c && !ordered.includes(c)) ordered.push(c);
  });

  const serialColumn = findSerialColumn(ordered);
  if (serialColumn) {
    return [serialColumn, ...ordered.filter(col => col !== serialColumn)];
  }

  return ordered;
}

function reorderRowByColumns(row, columns) {
  const ordered = {};
  columns.forEach(col => {
    ordered[col] = row?.[col] ?? '';
  });
  return ordered;
}

function normalizeSectionKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function sanitizeSizeMap(value, { min, max }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  Object.entries(value).forEach(([key, raw]) => {
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    out[String(key)] = Math.max(min, Math.min(max, num));
  });
  return out;
}

function normalizeLayout(layout) {
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) {
    return { columnWidths: {}, rowHeights: {}, extraSections: [] };
  }

  const rawExtra = Array.isArray(layout.extraSections) ? layout.extraSections : [];
  const seen = new Set();
  const extraSections = rawExtra
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
    .map(item => {
      const key = normalizeSectionKey(item.key);
      const label = String(item.label || '').trim();
      if (!key || !label || seen.has(key)) return null;
      seen.add(key);
      return {
        key,
        label,
        rows: withAutoSerial(item.rows),
        columns: Array.isArray(item.columns) ? item.columns.map(col => String(col || '').trim()).filter(Boolean) : [],
      };
    })
    .filter(Boolean);

  return {
    columnWidths: sanitizeSizeMap(layout.columnWidths, { min: 120, max: 520 }),
    rowHeights: sanitizeSizeMap(layout.rowHeights, { min: 48, max: 260 }),
    extraSections,
  };
}

function normalizeInitialSections(initialData) {
  return {
    useCases: withAutoSerial(initialData?.useCases),
    workflows: withAutoSerial(initialData?.workflows),
    businessRules: withAutoSerial(initialData?.businessRules),
  };
}

function normalizeSheetName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function isEffectivelyEmptyRow(row) {
  if (!row || typeof row !== 'object') return true;
  return Object.values(row).every(value => String(value ?? '').trim() === '');
}

function extractRowsFromSheet(sheet) {
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rows.filter(row => !isEffectivelyEmptyRow(row));
}

function resolveWorkbookSections(workbook) {
  const names = workbook.SheetNames || [];
  const normalized = names.map(name => ({ name, key: normalizeSheetName(name) }));

  const findByCandidates = (candidates) => {
    const hit = normalized.find(item => candidates.some(c => item.key.includes(c)));
    return hit?.name || null;
  };

  const useCasesName = findByCandidates(['uc_coverage', 'use_case', 'use_cases', 'usecase', 'coverage']) || names[0] || null;
  const workflowsName = findByCandidates(['workflow_execution', 'workflow', 'workflows']) || names[1] || null;
  const businessRulesName = findByCandidates(['business_rules', 'business_rule', 'rules']) || names[2] || null;

  return {
    useCases: extractRowsFromSheet(useCasesName ? workbook.Sheets[useCasesName] : null),
    workflows: extractRowsFromSheet(workflowsName ? workbook.Sheets[workflowsName] : null),
    businessRules: extractRowsFromSheet(businessRulesName ? workbook.Sheets[businessRulesName] : null),
  };
}

function RichTextCell({ value, onChange, editable, onFocus }) {
  if (!editable) {
    return (
      <div
        className="min-h-[44px] text-sm text-gray-700 px-1.5 py-1"
        dangerouslySetInnerHTML={{ __html: value || '' }}
      />
    );
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'min-h-[44px] text-sm px-1.5 py-1 outline-none',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    onFocus: ({ editor: ed }) => {
      onFocus?.(ed);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || '') !== current) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}

export default function ModuleSpecifications({
  moduleId,
  isAdmin,
  initialData,
  initialSection = 'useCases',
  onSaved,
  drawerMode = false,
}) {
  const [activeSection, setActiveSection] = useState(initialSection);
  const initialSections = useMemo(() => normalizeInitialSections(initialData), [initialData]);
  const initialLayout = useMemo(() => normalizeLayout(initialData?.layout), [initialData]);
  const [extraSections, setExtraSections] = useState(initialLayout.extraSections.map(({ key, label }) => ({ key, label })));
  const [tables, setTables] = useState({
    useCases: initialSections.useCases,
    workflows: initialSections.workflows,
    businessRules: initialSections.businessRules,
    ...Object.fromEntries(initialLayout.extraSections.map(section => [section.key, section.rows])),
  });
  const [manualColumns, setManualColumns] = useState({
    useCases: [],
    workflows: [],
    businessRules: [],
    ...Object.fromEntries(initialLayout.extraSections.map(section => [section.key, section.columns])),
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveJustNow, setSaveJustNow] = useState(false);
  const [activeEditor, setActiveEditor] = useState(null);
  const [activeCell, setActiveCell] = useState(null);
  const [columnWidths, setColumnWidths] = useState(initialLayout.columnWidths);
  const [rowHeights, setRowHeights] = useState(initialLayout.rowHeights);
  const [resizeDrag, setResizeDrag] = useState(null);
  const [headerDialog, setHeaderDialog] = useState({
    open: false,
    mode: 'add',
    oldName: '',
    value: '',
  });
  const [sectionDialog, setSectionDialog] = useState({
    open: false,
    value: '',
  });
  const tableScrollRef = useRef(null);
  const wasResizingRef = useRef(false);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    const nextTables = initialSections;
    const nextLayout = normalizeLayout(initialData?.layout);
    const extraMeta = nextLayout.extraSections.map(section => ({ key: section.key, label: section.label }));

    setExtraSections(extraMeta);
    setTables({
      ...nextTables,
      ...Object.fromEntries(nextLayout.extraSections.map(section => [section.key, section.rows])),
    });
    setManualColumns(prev => {
      const next = {
        useCases: orderColumns(Array.from(new Set([...collectColumns(nextTables.useCases), ...(prev?.useCases || [])])), prev?.useCases || []),
        workflows: orderColumns(Array.from(new Set([...collectColumns(nextTables.workflows), ...(prev?.workflows || [])])), prev?.workflows || []),
        businessRules: orderColumns(Array.from(new Set([...collectColumns(nextTables.businessRules), ...(prev?.businessRules || [])])), prev?.businessRules || []),
      };

      nextLayout.extraSections.forEach(section => {
        const preferred = section.columns?.length ? section.columns : (prev?.[section.key] || []);
        next[section.key] = orderColumns(
          Array.from(new Set([...collectColumns(section.rows), ...preferred])),
          preferred,
        );
      });

      return next;
    });
    setColumnWidths(nextLayout.columnWidths);
    setRowHeights(nextLayout.rowHeights);

    const validSections = new Set([...BASE_SECTIONS.map(section => section.key), ...extraMeta.map(section => section.key)]);
    setActiveSection(prev => (validSections.has(prev) ? prev : initialSection));
  }, [initialSections, initialData, initialSection]);

  useEffect(() => {
    if (!saveJustNow) return;
    const t = window.setTimeout(() => setSaveJustNow(false), 1800);
    return () => window.clearTimeout(t);
  }, [saveJustNow]);

  const columnsBySection = useMemo(() => {
    const deriveColumns = (rows, extras = []) => {
      const discovered = Array.from(new Set([...(extras || []), ...collectColumns(rows)]));
      return orderColumns(discovered, extras || []);
    };

    const out = {};
    Object.keys(tables || {}).forEach(sectionKey => {
      out[sectionKey] = deriveColumns(tables[sectionKey], manualColumns[sectionKey]);
    });
    return out;
  }, [tables, manualColumns]);

  const sectionTabs = useMemo(
    () => [...BASE_SECTIONS, ...extraSections.map(section => ({ key: section.key, label: section.label }))],
    [extraSections],
  );

  const currentRows = tables[activeSection] || [];
  const currentColumns = columnsBySection[activeSection] || [];

  const getColumnWidth = (column) => {
    const k = `${activeSection}:${column}`;
    return columnWidths[k] || 180;
  };

  const getRowHeight = (rowIndex) => {
    const k = `${activeSection}:${rowIndex}`;
    return rowHeights[k] || 64;
  };

  useEffect(() => {
    if (!resizeDrag) return;

    wasResizingRef.current = true;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = resizeDrag.type === 'col' ? 'col-resize' : 'row-resize';

    const onMove = (event) => {
      if (resizeDrag.type === 'col') {
        const next = Math.max(120, Math.min(520, resizeDrag.startSize + (event.clientX - resizeDrag.startX)));
        setColumnWidths(prev => ({ ...prev, [resizeDrag.key]: next }));
      } else {
        const next = Math.max(48, Math.min(260, resizeDrag.startSize + (event.clientY - resizeDrag.startY)));
        setRowHeights(prev => ({ ...prev, [resizeDrag.key]: next }));
      }
    };

    const onUp = () => {
      setResizeDrag(null);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [resizeDrag]);

  useEffect(() => {
    if (resizeDrag || !wasResizingRef.current || !isAdmin) return;
    wasResizingRef.current = false;
    const preferredColumns = buildPreferredColumns(columnsBySection, tables);
    persistTables(tables, preferredColumns);
  }, [resizeDrag]);

  const startColumnResize = (column, event) => {
    if (!isAdmin) return;
    event.preventDefault();
    event.stopPropagation();
    const key = `${activeSection}:${column}`;
    setResizeDrag({
      type: 'col',
      key,
      startX: event.clientX,
      startY: event.clientY,
      startSize: getColumnWidth(column),
    });
  };

  const startRowResize = (rowIndex, event) => {
    if (!isAdmin) return;
    event.preventDefault();
    event.stopPropagation();
    const key = `${activeSection}:${rowIndex}`;
    setResizeDrag({
      type: 'row',
      key,
      startX: event.clientX,
      startY: event.clientY,
      startSize: getRowHeight(rowIndex),
    });
  };

  const handleUploadWorkbook = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const rawSections = resolveWorkbookSections(workbook);
      const sections = {
        useCases: withAutoSerial(rawSections.useCases),
        workflows: withAutoSerial(rawSections.workflows),
        businessRules: withAutoSerial(rawSections.businessRules),
      };
      setTables(sections);
      setManualColumns({
        useCases: Object.keys(sections.useCases?.[0] || {}),
        workflows: Object.keys(sections.workflows?.[0] || {}),
        businessRules: Object.keys(sections.businessRules?.[0] || {}),
      });
      setExtraSections([]);
      setActiveSection('useCases');
    } catch {
      alert('Unable to read Excel file. Please upload a valid workbook.');
    } finally {
      event.target.value = '';
    }
  };

  const updateCell = (sectionKey, rowIndex, column, nextValue) => {
    setTables(prev => ({
      ...prev,
      [sectionKey]: prev[sectionKey].map((row, idx) => (
        idx === rowIndex
          ? { ...row, [column]: nextValue }
          : row
      )),
    }));
  };

  const buildPreferredColumns = (nextManual = manualColumns, nextTables = tables) => {
    const out = {};
    Object.keys(nextTables || {}).forEach(sectionKey => {
      out[sectionKey] = [...(nextManual?.[sectionKey] || [])];
    });
    return out;
  };

  const openAddSectionDialog = () => {
    if (!isAdmin) return;
    setSectionDialog({ open: true, value: '' });
  };

  const applySectionDialog = async () => {
    if (!isAdmin) return;
    const label = String(sectionDialog.value || '').trim();
    if (!label) return;

    const displayLabel = label;
    const existingKeys = new Set(Object.keys(tables || {}));
    const baseKey = normalizeSectionKey(displayLabel) || 'section';
    let nextKey = baseKey;
    let counter = 2;
    while (existingKeys.has(nextKey)) {
      nextKey = `${baseKey}_${counter}`;
      counter += 1;
    }

    const nextExtraSections = [...extraSections, { key: nextKey, label: displayLabel }];
    const nextTables = {
      ...tables,
      [nextKey]: [],
    };
    const nextManualColumns = {
      ...manualColumns,
      [nextKey]: [DEFAULT_SERIAL_COLUMN],
    };
    const preferredColumns = buildPreferredColumns(nextManualColumns, nextTables);

    setExtraSections(nextExtraSections);
    setTables(nextTables);
    setManualColumns(nextManualColumns);
    setActiveSection(nextKey);
    setSectionDialog({ open: false, value: '' });
    await persistTables(nextTables, preferredColumns, nextExtraSections);
  };

  const addRow = () => {
    if (!isAdmin) return;
    let columns = currentColumns.length > 0 ? [...currentColumns] : ['Column 1'];
    let serialColumn = findSerialColumn(columns);
    if (!serialColumn) {
      serialColumn = DEFAULT_SERIAL_COLUMN;
      columns = [serialColumn, ...columns];
    }

    const newRow = {};
    columns.forEach(col => {
      newRow[col] = '';
    });
    newRow[serialColumn] = String(currentRows.length + 1);

    setTables(prev => ({
      ...prev,
      [activeSection]: [...prev[activeSection], newRow],
    }));

    const targetRowIndex = currentRows.length;
    const firstEditableColumn = columns.find(col => !isSerialColumnName(col)) || columns[0];
    setActiveCell({ section: activeSection, row: targetRowIndex, col: firstEditableColumn });

    requestAnimationFrame(() => {
      if (!tableScrollRef.current) return;
      tableScrollRef.current.scrollTop = tableScrollRef.current.scrollHeight;
    });
  };

  const canDeleteActiveRow = Boolean(
    isAdmin
      && activeCell
      && activeCell.section === activeSection
      && Number.isInteger(activeCell.row)
      && activeCell.row >= 0
      && activeCell.row < currentRows.length
  );

  const canDeleteActiveColumn = Boolean(
    isAdmin
      && activeCell
      && activeCell.section === activeSection
      && typeof activeCell.col === 'string'
      && activeCell.col.trim()
      && !isSerialColumnName(activeCell.col)
      && currentColumns.length > 1
  );

  const deleteActiveRow = async () => {
    if (!canDeleteActiveRow) return;

    const rowIndex = activeCell.row;
    const serialColumn = findSerialColumn(currentColumns) || DEFAULT_SERIAL_COLUMN;

    const nextRows = (tables[activeSection] || [])
      .filter((_, idx) => idx !== rowIndex)
      .map((row, idx) => ({
        ...row,
        [serialColumn]: String(idx + 1),
      }));

    const nextTables = {
      ...tables,
      [activeSection]: nextRows,
    };

    const preferredColumns = buildPreferredColumns();

    setTables(nextTables);

    setActiveCell(null);
    await persistTables(nextTables, preferredColumns);
  };

  const deleteActiveColumn = async () => {
    if (!canDeleteActiveColumn) return;

    const targetColumn = activeCell.col;

    const nextTables = {
      ...tables,
      [activeSection]: (tables[activeSection] || []).map(row => {
        const next = { ...row };
        delete next[targetColumn];
        return next;
      }),
    };

    const nextManualColumns = {
      ...manualColumns,
      [activeSection]: (manualColumns[activeSection] || []).filter(col => col !== targetColumn),
    };

    const preferredColumns = buildPreferredColumns(nextManualColumns, nextTables);

    setTables(nextTables);
    setManualColumns(nextManualColumns);

    setActiveCell(null);
    await persistTables(nextTables, preferredColumns);
  };

  const deleteCurrentSection = async () => {
    if (!isAdmin) return;

    const isCustomSection = extraSections.some(section => section.key === activeSection);

    if (isCustomSection) {
      const nextExtraSections = extraSections.filter(section => section.key !== activeSection);
      const { [activeSection]: _removedRows, ...nextTables } = tables;
      const { [activeSection]: _removedColumns, ...nextManualColumns } = manualColumns;
      const preferredColumns = buildPreferredColumns(nextManualColumns, nextTables);

      setExtraSections(nextExtraSections);
      setTables(nextTables);
      setManualColumns(nextManualColumns);
      setActiveCell(null);
      setActiveSection('useCases');
      await persistTables(nextTables, preferredColumns, nextExtraSections);
      return;
    }

    const serialColumn = findSerialColumn(currentColumns) || DEFAULT_SERIAL_COLUMN;

    const nextTables = {
      ...tables,
      [activeSection]: [],
    };
    const nextManualColumns = {
      ...manualColumns,
      [activeSection]: [serialColumn],
    };

    const preferredColumns = buildPreferredColumns(nextManualColumns, nextTables);

    setTables(nextTables);
    setManualColumns(nextManualColumns);
    setActiveCell(null);
    await persistTables(nextTables, preferredColumns);
  };

  const openAddHeaderDialog = () => {
    if (!isAdmin) return;
    setHeaderDialog({
      open: true,
      mode: 'add',
      oldName: '',
      value: '',
    });
  };

  const openRenameHeaderDialog = (columnName) => {
    if (!isAdmin) return;
    setHeaderDialog({
      open: true,
      mode: 'rename',
      oldName: columnName,
      value: columnName,
    });
  };

  const applyHeaderDialog = () => {
    const value = String(headerDialog.value || '').trim();
    if (!value) return;

    if (headerDialog.mode === 'add') {
      if (currentColumns.includes(value)) {
        alert('Header already exists.');
        return;
      }

      setManualColumns(prev => ({
        ...prev,
        [activeSection]: [...prev[activeSection], value],
      }));

      setTables(prev => ({
        ...prev,
        [activeSection]: prev[activeSection].map(row => ({
          ...row,
          [value]: row?.[value] ?? '',
        })),
      }));

      if ((currentRows || []).length > 0) {
        setActiveCell({ section: activeSection, row: 0, col: value });
      }

      requestAnimationFrame(() => {
        if (!tableScrollRef.current) return;
        tableScrollRef.current.scrollLeft = tableScrollRef.current.scrollWidth;
      });
    } else {
      const oldName = headerDialog.oldName;
      if (!oldName || oldName === value) {
        setHeaderDialog({ open: false, mode: 'add', oldName: '', value: '' });
        return;
      }
      if (currentColumns.includes(value)) {
        alert('A header with this name already exists.');
        return;
      }

      setManualColumns(prev => ({
        ...prev,
        [activeSection]: prev[activeSection].map(col => col === oldName ? value : col),
      }));

      setTables(prev => ({
        ...prev,
        [activeSection]: prev[activeSection].map(row => {
          const next = { ...row };
          next[value] = next[oldName] ?? '';
          delete next[oldName];
          return next;
        }),
      }));
    }

    setHeaderDialog({ open: false, mode: 'add', oldName: '', value: '' });
  };

  const normalizeSectionForSave = (rows, preferred) => {
    const withSerial = withAutoSerial(rows);
    const discovered = Array.from(new Set([...(preferred || []), ...collectColumns(withSerial)]));
    const orderedColumns = orderColumns(discovered, preferred || []);
    return {
      orderedColumns,
      rows: withSerial.map(row => reorderRowByColumns(row, orderedColumns)),
    };
  };

  const buildLayoutPayload = (nextTables, preferredColumns, nextExtraSections) => ({
    columnWidths: sanitizeSizeMap(columnWidths, { min: 120, max: 520 }),
    rowHeights: sanitizeSizeMap(rowHeights, { min: 48, max: 260 }),
    extraSections: (nextExtraSections || []).map(section => ({
      key: section.key,
      label: section.label,
      rows: nextTables[section.key] || [],
      columns: preferredColumns[section.key] || [],
    })),
  });

  const persistTables = async (nextTables, preferredColumns, nextExtraSections = extraSections) => {
    if (!isAdmin) return;

    setIsSaving(true);
    setSaveJustNow(false);

    try {
      const saved = await saveModuleSpecifications(moduleId, {
        useCases: nextTables.useCases,
        workflows: nextTables.workflows,
        businessRules: nextTables.businessRules,
        layout: buildLayoutPayload(nextTables, preferredColumns, nextExtraSections),
      });

      const useCasesNorm = normalizeSectionForSave(saved.useCases, preferredColumns.useCases);
      const workflowsNorm = normalizeSectionForSave(saved.workflows, preferredColumns.workflows);
      const businessRulesNorm = normalizeSectionForSave(saved.businessRules, preferredColumns.businessRules);

      const savedLayout = normalizeLayout(saved.layout);
      const effectiveExtraSections = savedLayout.extraSections.length > 0
        ? savedLayout.extraSections
        : (nextExtraSections || []).map(section => ({
          key: section.key,
          label: section.label,
          rows: nextTables[section.key] || [],
          columns: preferredColumns[section.key] || [],
        }));

      const normalizedSaved = {
        useCases: useCasesNorm.rows,
        workflows: workflowsNorm.rows,
        businessRules: businessRulesNorm.rows,
      };

      const normalizedManualColumns = {
        useCases: useCasesNorm.orderedColumns,
        workflows: workflowsNorm.orderedColumns,
        businessRules: businessRulesNorm.orderedColumns,
      };

      const nextExtraMeta = [];
      effectiveExtraSections.forEach(section => {
        const normalized = normalizeSectionForSave(section.rows, section.columns || preferredColumns[section.key]);
        normalizedSaved[section.key] = normalized.rows;
        normalizedManualColumns[section.key] = normalized.orderedColumns;
        nextExtraMeta.push({ key: section.key, label: section.label });
      });

      setTables(normalizedSaved);
      setManualColumns(normalizedManualColumns);
      setExtraSections(nextExtraMeta);
      setColumnWidths(savedLayout.columnWidths);
      setRowHeights(savedLayout.rowHeights);
      onSaved?.({ ...normalizedSaved, layout: savedLayout });
      setSaveJustNow(true);
    } catch (err) {
      alert(err?.response?.data?.error || err?.message || 'Failed to save module specifications.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAll = async () => {
    if (!isAdmin) return;
    const preferredColumns = buildPreferredColumns(columnsBySection, tables);
    await persistTables(tables, preferredColumns);
  };

  const rootHeightClass = 'h-full';

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden ${rootHeightClass} ${drawerMode ? 'rounded-none border-0 border-l' : ''}`}>
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {sectionTabs.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => setActiveSection(section.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeSection === section.key ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'}`}
            >
              {section.label}
            </button>
          ))}
          {isAdmin && (
            <button
              type="button"
              onClick={openAddSectionDialog}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
              title="Add section"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 cursor-pointer hover:bg-gray-50">
                <Upload className="w-4 h-4" /> Upload Excel
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUploadWorkbook} />
              </label>
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" /> Add Row
              </button>
              <button
                type="button"
                onClick={openAddHeaderDialog}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
              >
                <Columns3 className="w-4 h-4" /> Add Column
              </button>
            </div>

            <div className="h-6 w-px bg-gray-300" />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={deleteActiveRow}
                disabled={!canDeleteActiveRow}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Delete Row
              </button>
              <button
                type="button"
                onClick={deleteActiveColumn}
                disabled={!canDeleteActiveColumn}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Delete Column
              </button>
              <button
                type="button"
                onClick={deleteCurrentSection}
                disabled={!isAdmin}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>

            <div className="h-6 w-px bg-gray-300" />

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm disabled:opacity-60 ${saveJustNow ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : saveJustNow ? 'Saved' : 'Save All'}
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="px-4 py-2 border-b border-gray-200 bg-white flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Format</span>
          <button
            type="button"
            onClick={() => activeEditor?.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded border ${activeEditor?.isActive('bold') ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-600'}`}
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => activeEditor?.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded border ${activeEditor?.isActive('italic') ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-600'}`}
            title="Italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => activeEditor?.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded border ${activeEditor?.isActive('underline') ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-600'}`}
            title="Underline"
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </button>
          <span className="ml-2 text-xs text-gray-500">Drag header borders to resize columns. Drag row border to resize row height.</span>
        </div>
      )}

      <div className="p-4 flex-1 min-h-0">
        {currentColumns.length === 0 ? (
          <div className="h-full text-sm text-gray-500 border border-dashed border-gray-300 rounded-xl p-6 text-center flex flex-col items-center justify-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <FileSpreadsheet className="w-4 h-4" />
              No rows loaded in this section.
            </div>
            {isAdmin ? 'Upload an Excel file or add a row to begin.' : 'No specifications available yet.'}
          </div>
        ) : (
          <div ref={tableScrollRef} className="h-full overflow-auto border border-gray-200 rounded-xl bg-white">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {currentColumns.map(col => (
                    <th
                      key={col}
                      onDoubleClick={() => openRenameHeaderDialog(col)}
                      title={isAdmin ? 'Double click to rename header' : undefined}
                      className="sticky top-0 z-10 bg-gray-100 border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700 shadow-[inset_0_-1px_0_0_rgba(229,231,235,1)] relative"
                      style={{ width: `${getColumnWidth(col)}px`, minWidth: `${getColumnWidth(col)}px` }}
                    >
                      {col}
                      {isAdmin && (
                        <span
                          onMouseDown={(e) => startColumnResize(col, e)}
                          className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-indigo-200"
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentRows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`}>
                    {currentColumns.map((col, colIndex) => {
                      const value = row?.[col] ?? '';
                        const serialCol = isSerialColumnName(col);
                      const isActive = activeCell?.section === activeSection && activeCell?.row === rowIndex && activeCell?.col === col;
                      const rowHeight = getRowHeight(rowIndex);
                      const colWidth = getColumnWidth(col);

                      return (
                        <td
                          key={`${rowIndex}-${col}`}
                          className={`border border-gray-200 align-top transition-colors relative ${isActive ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-300' : rowIndex % 2 === 0 ? 'bg-white' : 'bg-blue-50/60'}`}
                          style={{ width: `${colWidth}px`, minWidth: `${colWidth}px`, height: `${rowHeight}px` }}
                          onClick={() => setActiveCell({ section: activeSection, row: rowIndex, col })}
                        >
                          {serialCol ? (
                            <div className="min-h-[44px] text-sm text-gray-700 px-1.5 py-1">
                              {String(value || rowIndex + 1)}
                            </div>
                          ) : (
                            <RichTextCell
                              value={String(value)}
                              onChange={(next) => updateCell(activeSection, rowIndex, col, next)}
                              editable={isAdmin}
                              onFocus={(editor) => {
                                setActiveCell({ section: activeSection, row: rowIndex, col });
                                setActiveEditor(editor);
                              }}
                            />
                          )}
                          {isAdmin && colIndex === 0 && (
                            <span
                              onMouseDown={(e) => startRowResize(rowIndex, e)}
                              className="absolute left-0 bottom-0 w-full h-1.5 cursor-row-resize bg-transparent hover:bg-indigo-200"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {headerDialog.open && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              {headerDialog.mode === 'add' ? 'Add Header' : 'Rename Header'}
            </h3>
            <input
              autoFocus
              value={headerDialog.value}
              onChange={(e) => setHeaderDialog(prev => ({ ...prev, value: e.target.value }))}
              placeholder="Header name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyHeaderDialog();
                if (e.key === 'Escape') setHeaderDialog({ open: false, mode: 'add', oldName: '', value: '' });
              }}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setHeaderDialog({ open: false, mode: 'add', oldName: '', value: '' })}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyHeaderDialog}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
              >
                {headerDialog.mode === 'add' ? 'Add' : 'Rename'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sectionDialog.open && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Add Section</h3>
            <input
              autoFocus
              value={sectionDialog.value}
              onChange={(e) => setSectionDialog(prev => ({ ...prev, value: e.target.value }))}
              placeholder="Section name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') applySectionDialog();
                if (e.key === 'Escape') setSectionDialog({ open: false, value: '' });
              }}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSectionDialog({ open: false, value: '' })}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applySectionDialog}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
