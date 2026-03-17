import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchAllModules,
  createModule,
  updateModule,
  deleteModule,
  duplicateModule,
  bulkUpdateTimer,
} from './api';
import {
  Shield,
  Edit2,
  Trash2,
  Plus,
  Clock,
  Copy,
  Calendar,
  Users,
  LayoutDashboard,
  Download,
  Timer,
  CheckSquare,
  Square,
} from 'lucide-react';
import ConfirmModal from './components/ConfirmModal';
import MasterLeadsData from './MasterLeadsData';

// ── Timer helpers ──────────────────────────────────────────────────────────────

function getTimerStatus(accessStart, accessEnd) {
  if (!accessStart && !accessEnd) return { label: 'Unrestricted', color: 'gray' };
  const now = Date.now();
  const start = accessStart ? new Date(accessStart).getTime() : null;
  const end = accessEnd ? new Date(accessEnd).getTime() : null;

  if (start && now < start) return { label: 'Upcoming', color: 'blue' };
  if (end && now > end) return { label: 'Expired', color: 'red' };
  return { label: 'Active', color: 'green' };
}

function formatDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Convert an ISO string or null to the value needed by <input type="datetime-local"> */
function toDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  // Format: YYYY-MM-DDTHH:MM (local time)
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert a datetime-local input value to ISO string, or null if empty */
function fromDatetimeLocal(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

const STATUS_CLASSES = {
  gray:  'bg-gray-100 text-gray-600',
  blue:  'bg-blue-100 text-blue-700',
  green: 'bg-emerald-100 text-emerald-700',
  red:   'bg-red-100 text-red-600',
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminDashboard({ onSelectModule }) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('modules');

  // Create / edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    name: '',
    assigned_leads: '',
    access_start: '',
    access_end: '',
    date: getTodayDate(),
    has_backend: true,
    has_frontend: true,
  });

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [moduleToDelete, setModuleToDelete] = useState(null);

  // Bulk timer
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [timerModalOpen, setTimerModalOpen] = useState(false);
  const [timerForm, setTimerForm] = useState({ access_start: '', access_end: '' });
  const [timerSaving, setTimerSaving] = useState(false);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadModules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data = await fetchAllModules();
      if (!Array.isArray(data)) {
        data = [];
      } else {
        data = data.filter(m => m && typeof m === 'object' && m.groups && Array.isArray(m.assigned_leads));
      }
      setModules(data);
    } catch (err) {
      setError(err.message || 'Failed to load modules');
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadModules(); }, [loadModules]);

  const sortedModules = useMemo(() =>
    [...modules].sort((a, b) =>
      String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { numeric: true, sensitivity: 'base' })
    ), [modules]);

  // ── Module create / edit modal ─────────────────────────────────────────────

  const handleOpenModal = (mod = null) => {
    if (mod) {
      setEditingModule(mod.id);
      setFormData({
        name: mod.name,
        assigned_leads: mod.assigned_leads.join(', '),
        access_start: toDatetimeLocal(mod.access_start),
        access_end: toDatetimeLocal(mod.access_end),
        date: mod.date || getTodayDate(),
        has_backend: mod.has_backend !== false,
        has_frontend: mod.has_frontend !== false,
      });
    } else {
      setEditingModule(null);
      setFormData({
        name: '',
        assigned_leads: '',
        access_start: '',
        access_end: '',
        date: getTodayDate(),
        has_backend: true,
        has_frontend: true,
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const accessStart = fromDatetimeLocal(formData.access_start);
    const accessEnd = fromDatetimeLocal(formData.access_end);
    if (accessStart && accessEnd && new Date(accessStart) >= new Date(accessEnd)) {
      alert('Access end must be after access start.');
      return;
    }

    const payload = {
      name: formData.name,
      assigned_leads: formData.assigned_leads.split(',').map(s => s.trim()).filter(Boolean),
      access_start: accessStart,
      access_end: accessEnd,
      date: formData.date,
      has_backend: formData.has_backend,
      has_frontend: formData.has_frontend,
    };

    try {
      if (editingModule) {
        await updateModule(editingModule, payload);
      } else {
        await createModule(payload);
      }
      setModalOpen(false);
      loadModules();
    } catch (err) {
      alert(err.message || 'Failed to save module.');
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const confirmDelete = (id) => { setModuleToDelete(id); setDeleteConfirmOpen(true); };

  const handleDelete = async () => {
    if (!moduleToDelete) return;
    try {
      await deleteModule(moduleToDelete);
    } catch (err) {
      alert(err.message || 'Failed to delete module.');
    } finally {
      setDeleteConfirmOpen(false);
      setModuleToDelete(null);
      loadModules();
    }
  };

  const handleDuplicate = async (id) => {
    try { await duplicateModule(id); loadModules(); }
    catch (err) { alert(err.message || 'Failed to duplicate module.'); }
  };

  // ── Bulk selection ─────────────────────────────────────────────────────────

  const allSelected = sortedModules.length > 0 && sortedModules.every(m => selectedIds.has(m.id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedModules.map(m => m.id)));
    }
  };

  const toggleOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Bulk timer ─────────────────────────────────────────────────────────────

  const openTimerModal = () => {
    setTimerForm({ access_start: '', access_end: '' });
    setTimerModalOpen(true);
  };

  const handleBulkTimerSave = async (e) => {
    e.preventDefault();
    const accessStart = fromDatetimeLocal(timerForm.access_start);
    const accessEnd = fromDatetimeLocal(timerForm.access_end);
    if (accessStart && accessEnd && new Date(accessStart) >= new Date(accessEnd)) {
      alert('Access end must be after access start.');
      return;
    }
    setTimerSaving(true);
    try {
      await bulkUpdateTimer([...selectedIds], accessStart, accessEnd);
      setTimerModalOpen(false);
      setSelectedIds(new Set());
      loadModules();
    } catch (err) {
      alert(err.message || 'Failed to update timers.');
    } finally {
      setTimerSaving(false);
    }
  };

  const handleClearTimer = async () => {
    if (!window.confirm(`Clear timer for ${selectedIds.size} module(s)?`)) return;
    setTimerSaving(true);
    try {
      await bulkUpdateTimer([...selectedIds], null, null);
      setTimerModalOpen(false);
      setSelectedIds(new Set());
      loadModules();
    } catch (err) {
      alert(err.message || 'Failed to clear timers.');
    } finally {
      setTimerSaving(false);
    }
  };

  // ── CSV export ─────────────────────────────────────────────────────────────

  const csvEscape = (value) => {
    const str = value == null ? '' : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const formatChecklist = (obj) =>
    Object.entries(obj || {}).map(([key, done]) => `${key}: ${done ? 'Completed' : 'Pending'}`).join('\n');

  const formatList = (arr) => (Array.isArray(arr) ? arr.join('\n') : '');

  const formatFeatures = (features) => {
    if (!Array.isArray(features) || features.length === 0) return '';
    return features.map(f => {
      const id = f?.id != null ? `#${f.id}` : 'NoId';
      return `${id} ${f?.name || 'Unnamed'} (Backend: ${f?.backend ? 'Yes' : 'No'} | Frontend: ${f?.frontend ? 'Yes' : 'No'})`;
    }).join('\n');
  };

  const buildCsvFromModules = (modulesList) => {
    const headers = [
      'Module ID', 'Module Name', 'Date',
      'Access Start', 'Access End', 'Has Backend', 'Has Frontend', 'Assigned Leads',
      'Group ID', 'Pair ID', 'Roll Numbers', 'Category', 'Is Merged', 'Partner Pair ID',
      'Overall Status', 'Backend Files', 'Backend API Endpoints', 'Backend Functions',
      'Backend Architecture Match', 'Backend Architecture Note',
      'Frontend Files', 'Frontend Endpoints Integrated',
      'UI/UX Matches Fusion ERP', 'Frontend Architecture Match', 'Frontend Architecture Note',
      'Features Integration', 'Notes & Observations', 'Module Created At', 'Module Updated At',
    ];

    let csv = headers.map(csvEscape).join(',') + '\n';

    modulesList.forEach((mod) => {
      if (!mod || !Array.isArray(mod.assigned_leads)) return;
      const groups = Array.isArray(mod.groups) ? mod.groups : [];
      const rowBase = [
        mod.id || '', mod.name || '', mod.date || '',
        formatDateTime(mod.access_start) || '', formatDateTime(mod.access_end) || '',
        mod.has_backend !== false ? 'Yes' : 'No',
        mod.has_frontend !== false ? 'Yes' : 'No',
        mod.assigned_leads.join('; '),
      ];

      if (groups.length === 0) {
        csv += [...rowBase, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', mod.created_at || '', mod.updated_at || '']
          .map(csvEscape).join(',') + '\n';
        return;
      }

      groups.forEach((g) => {
        const ev = g?.evaluation || {};
        csv += [
          ...rowBase,
          g?.id || '', g?.pair_id || '',
          Array.isArray(g?.roll_numbers) ? g.roll_numbers.join('; ') : '',
          g?.category || '', g?.is_merged ? 'Yes' : 'No', g?.partner_pair_id || '',
          ev?.is_functional ? 'Fully Functional' : 'Issues Detected',
          formatChecklist(ev?.backend?.files), formatList(ev?.backend?.endpoints),
          formatList(ev?.backend?.functions),
          ev?.backend?.architecture_matches_reference ? 'Yes' : 'No',
          ev?.backend?.architecture_note || '',
          formatChecklist(ev?.frontend?.files),
          formatList(ev?.frontend?.endpoints_used),
          ev?.frontend?.ui_ux_matches_fusion_erp ? 'Yes' : 'No',
          ev?.frontend?.architecture_matches_reference ? 'Yes' : 'No',
          ev?.frontend?.architecture_note || '',
          formatFeatures(ev?.features), ev?.notes || '',
          mod.created_at || '', mod.updated_at || '',
        ].map(csvEscape).join(',') + '\n';
      });
    });

    return csv;
  };

  const downloadCsv = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAllToCSV = () => {
    if (!modules.length) { alert('No modules to export'); return; }
    downloadCsv(buildCsvFromModules(modules), 'all_modules_evaluation.csv');
  };

  const exportToCSV = (mod) => {
    if (!mod?.groups || !mod?.assigned_leads) { alert('Cannot export: Module data is incomplete'); return; }
    downloadCsv(buildCsvFromModules([mod]), `${mod.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_full_evaluation.csv`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div className="p-8 flex justify-center text-gray-500">Loading Admin Dashboard...</div>;
  if (error) return (
    <div className="p-8 flex justify-center text-red-600">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4"><strong>Error:</strong> {error}</div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Global Overview</h1>
          <p className="text-gray-500 mt-1">Admin Dashboard — Manage Modules &amp; Assignments</p>
        </div>
        <div className="flex items-center space-x-3">
          {someSelected && (
            <button
              onClick={openTimerModal}
              className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 flex items-center text-sm font-medium cursor-pointer transition-colors shadow-sm"
            >
              <Timer className="w-4 h-4 mr-2" /> Set Timer ({selectedIds.size})
            </button>
          )}
          <button onClick={exportAllToCSV} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center text-sm font-medium cursor-pointer transition-colors shadow-sm">
            <Download className="w-4 h-4 mr-2" /> Export All
          </button>
          {activeTab === 'modules' && (
            <button onClick={() => handleOpenModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center text-sm font-medium cursor-pointer transition-colors shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Create Module
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'modules', label: 'Modules Overview', Icon: LayoutDashboard },
            { key: 'leads', label: 'Master Evaluation Data', Icon: Users },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center cursor-pointer ${activeTab === key ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              <Icon className="w-4 h-4 mr-2" />{label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'modules' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  <th className="px-4 py-4 w-10">
                    <button onClick={toggleAll} className="cursor-pointer text-gray-400 hover:text-indigo-600 transition-colors">
                      {allSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="px-6 py-4">Module</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Leads</th>
                  <th className="px-6 py-4">Access Window</th>
                  <th className="px-6 py-4">Progress</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedModules.map((mod) => {
                  if (!mod?.groups) return null;
                  const totalPairs = mod.groups.length;
                  const functionalPairs = mod.groups.filter(g => g.evaluation?.is_functional).length;
                  const progress = totalPairs > 0 ? Math.round((functionalPairs / totalPairs) * 100) : 0;
                  const status = getTimerStatus(mod.access_start, mod.access_end);
                  const isChecked = selectedIds.has(mod.id);

                  return (
                    <tr key={mod.id} className={`hover:bg-slate-50 transition-colors ${isChecked ? 'bg-indigo-50/30' : ''}`}>
                      <td className="px-4 py-4">
                        <button onClick={() => toggleOne(mod.id)} className="cursor-pointer text-gray-400 hover:text-indigo-600 transition-colors">
                          {isChecked ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{mod.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {mod.divisions?.length > 0 && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700">
                              {mod.divisions.length} division{mod.divisions.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Calendar className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                          {mod.date || 'Not set'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {mod.assigned_leads.length > 0
                          ? mod.assigned_leads.join(', ')
                          : <span className="italic text-gray-400">Unassigned</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[status.color]}`}>
                          <Clock className="w-3 h-3 mr-1" /> {status.label}
                        </span>
                        {(mod.access_start || mod.access_end) && (
                          <div className="text-xs text-gray-400 mt-1 font-mono">
                            {formatDateTime(mod.access_start) || '∞'} — {formatDateTime(mod.access_end) || '∞'}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 font-medium">{functionalPairs}/{totalPairs}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                        <button onClick={() => exportToCSV(mod)} className="text-emerald-600 hover:text-emerald-800 cursor-pointer p-1" title="Export CSV"><Download className="w-4 h-4 inline" /></button>
                        <button onClick={() => onSelectModule(mod.id)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium cursor-pointer">Manage</button>
                        <button onClick={() => handleDuplicate(mod.id)} className="text-gray-500 hover:text-indigo-600 cursor-pointer" title="Duplicate"><Copy className="w-4 h-4 inline" /></button>
                        <button onClick={() => handleOpenModal(mod)} className="text-gray-500 hover:text-indigo-600 cursor-pointer" title="Edit"><Edit2 className="w-4 h-4 inline" /></button>
                        <button onClick={() => confirmDelete(mod.id)} className="text-gray-500 hover:text-red-600 cursor-pointer" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                      </td>
                    </tr>
                  );
                })}
                {sortedModules.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500 italic">No modules found. Create one to get started.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <MasterLeadsData onSelectModule={onSelectModule} />
      )}

      {/* ── Create / Edit Module Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl">
            <h3 className="text-lg font-bold mb-4">{editingModule ? 'Edit Module' : 'Create Module'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Module Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input required type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Leads <span className="font-normal text-gray-400">(comma separated emails)</span></label>
                <input type="text" value={formData.assigned_leads} onChange={e => setFormData({ ...formData, assigned_leads: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" placeholder="lead1@example.com, lead2@example.com" />
              </div>
              <fieldset className="border border-gray-200 rounded-lg p-3">
                <legend className="text-xs font-semibold text-gray-500 px-1 uppercase tracking-wider">Access Window <span className="font-normal normal-case">(optional)</span></legend>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
                    <input type="datetime-local" value={formData.access_start} onChange={e => setFormData({ ...formData, access_start: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
                    <input type="datetime-local" value={formData.access_end} onChange={e => setFormData({ ...formData, access_end: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">Leave both empty for unrestricted access (leads can log in any time).</p>
              </fieldset>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={formData.has_backend} onChange={e => setFormData({ ...formData, has_backend: e.target.checked })} className="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-gray-700">Has Backend</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={formData.has_frontend} onChange={e => setFormData({ ...formData, has_frontend: e.target.checked })} className="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-gray-700">Has Frontend</span>
                </label>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bulk Timer Modal ── */}
      {timerModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center mb-4">
              <Timer className="w-5 h-5 text-amber-500 mr-2" />
              <h3 className="text-lg font-bold">Set Access Timer</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Setting timer for <span className="font-semibold text-gray-700">{selectedIds.size} module{selectedIds.size !== 1 ? 's' : ''}</span>.
              All selected modules will have their access window updated.
            </p>
            <form onSubmit={handleBulkTimerSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Access Start</label>
                <input
                  type="datetime-local"
                  value={timerForm.access_start}
                  onChange={e => setTimerForm({ ...timerForm, access_start: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Access End</label>
                <input
                  type="datetime-local"
                  value={timerForm.access_end}
                  onChange={e => setTimerForm({ ...timerForm, access_end: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-amber-500"
                />
              </div>
              <p className="text-xs text-gray-400">Leave empty to remove restriction on that boundary.</p>
              <div className="flex justify-between items-center mt-6">
                <button
                  type="button"
                  onClick={handleClearTimer}
                  disabled={timerSaving}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Clear Timer
                </button>
                <div className="flex space-x-2">
                  <button type="button" onClick={() => setTimerModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
                  <button
                    type="submit"
                    disabled={timerSaving}
                    className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {timerSaving ? 'Saving…' : 'Apply Timer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Module"
        message="Are you sure you want to delete this module? This will also delete all pairs and evaluations inside it. This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => { setDeleteConfirmOpen(false); setModuleToDelete(null); }}
      />
    </div>
  );
}
