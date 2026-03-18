import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Bold, Italic, Underline as UnderlineIcon, Upload, Save, Plus, FileSpreadsheet, Columns3 } from 'lucide-react';
import { saveModuleSpecifications } from '../api';

const SECTION_META = {
  useCases: { label: 'Use Cases' },
  workflows: { label: 'Workflows' },
  businessRules: { label: 'Business Rules' },
};

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
      Underline,
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
  const [tables, setTables] = useState({
    useCases: Array.isArray(initialData?.useCases) ? initialData.useCases : [],
    workflows: Array.isArray(initialData?.workflows) ? initialData.workflows : [],
    businessRules: Array.isArray(initialData?.businessRules) ? initialData.businessRules : [],
  });
  const [manualColumns, setManualColumns] = useState({
    useCases: [],
    workflows: [],
    businessRules: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [activeEditor, setActiveEditor] = useState(null);
  const [activeCell, setActiveCell] = useState(null);
  const [columnWidths, setColumnWidths] = useState({});
  const [rowHeights, setRowHeights] = useState({});
  const [resizeDrag, setResizeDrag] = useState(null);
  const [headerDialog, setHeaderDialog] = useState({
    open: false,
    mode: 'add',
    oldName: '',
    value: '',
  });

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    const nextTables = {
      useCases: Array.isArray(initialData?.useCases) ? initialData.useCases : [],
      workflows: Array.isArray(initialData?.workflows) ? initialData.workflows : [],
      businessRules: Array.isArray(initialData?.businessRules) ? initialData.businessRules : [],
    };
    setTables(nextTables);
    setManualColumns({
      useCases: Object.keys(nextTables.useCases?.[0] || {}),
      workflows: Object.keys(nextTables.workflows?.[0] || {}),
      businessRules: Object.keys(nextTables.businessRules?.[0] || {}),
    });
  }, [initialData]);

  const columnsBySection = useMemo(() => {
    const deriveColumns = (rows, extras = []) => {
      const cols = [];
      extras.forEach(col => {
        const key = String(col || '').trim();
        if (key && !cols.includes(key)) cols.push(key);
      });
      rows.forEach(row => {
        Object.keys(row || {}).forEach(key => {
          const k = String(key || '').trim();
          if (k && !cols.includes(k)) cols.push(k);
        });
      });
      return cols;
    };

    return {
      useCases: deriveColumns(tables.useCases, manualColumns.useCases),
      workflows: deriveColumns(tables.workflows, manualColumns.workflows),
      businessRules: deriveColumns(tables.businessRules, manualColumns.businessRules),
    };
  }, [tables, manualColumns]);

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
      const sections = resolveWorkbookSections(workbook);
      setTables(sections);
      setManualColumns({
        useCases: Object.keys(sections.useCases?.[0] || {}),
        workflows: Object.keys(sections.workflows?.[0] || {}),
        businessRules: Object.keys(sections.businessRules?.[0] || {}),
      });
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

  const addRow = () => {
    if (!isAdmin) return;
    const columns = currentColumns.length > 0 ? currentColumns : ['Column 1'];
    const newRow = {};
    columns.forEach(col => {
      newRow[col] = '';
    });

    setTables(prev => ({
      ...prev,
      [activeSection]: [...prev[activeSection], newRow],
    }));
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

  const handleSaveAll = async () => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      const saved = await saveModuleSpecifications(moduleId, {
        useCases: tables.useCases,
        workflows: tables.workflows,
        businessRules: tables.businessRules,
      });
      setTables(saved);
      setManualColumns({
        useCases: Object.keys(saved.useCases?.[0] || {}),
        workflows: Object.keys(saved.workflows?.[0] || {}),
        businessRules: Object.keys(saved.businessRules?.[0] || {}),
      });
      onSaved?.(saved);
    } catch (err) {
      alert(err?.response?.data?.error || err?.message || 'Failed to save module specifications.');
    } finally {
      setIsSaving(false);
    }
  };

  const rootHeightClass = 'h-full';

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden ${rootHeightClass} ${drawerMode ? 'rounded-none border-0 border-l' : ''}`}>
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Object.entries(SECTION_META).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveSection(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeSection === key ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'}`}
            >
              {meta.label}
            </button>
          ))}
        </div>

        {isAdmin && (
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
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save All'}
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
          <div className="h-full overflow-auto border border-gray-200 rounded-xl bg-white">
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
                      const isActive = activeCell?.section === activeSection && activeCell?.row === rowIndex && activeCell?.col === col;
                      const rowHeight = getRowHeight(rowIndex);
                      const colWidth = getColumnWidth(col);

                      return (
                        <td
                          key={`${rowIndex}-${col}`}
                          className={`border border-gray-200 align-top transition-colors relative ${isActive ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-300' : 'bg-white'}`}
                          style={{ width: `${colWidth}px`, minWidth: `${colWidth}px`, height: `${rowHeight}px` }}
                          onClick={() => setActiveCell({ section: activeSection, row: rowIndex, col })}
                        >
                          <RichTextCell
                            value={String(value)}
                            onChange={(next) => updateCell(activeSection, rowIndex, col, next)}
                            editable={isAdmin}
                            onFocus={(editor) => {
                              setActiveCell({ section: activeSection, row: rowIndex, col });
                              setActiveEditor(editor);
                            }}
                          />
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
    </div>
  );
}
