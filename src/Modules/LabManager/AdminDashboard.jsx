import React, { useState, useEffect, useMemo } from 'react';
import { fetchAllModules, createModule, updateModule, deleteModule, duplicateModule } from './api';
import { Shield, Edit2, Trash2, Plus, ChevronRight, Clock, Copy, Calendar, Users, LayoutDashboard, Download } from 'lucide-react';
import ConfirmModal from './components/ConfirmModal';
import MasterLeadsData from './MasterLeadsData';

export default function AdminDashboard({ onSelectModule }) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [activeTab, setActiveTab] = useState('modules'); // 'modules' or 'leads'
  
  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [moduleToDelete, setModuleToDelete] = useState(null);
  
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  
  const [formData, setFormData] = useState({ 
    name: '', 
    assignment_name: '',
    assigned_leads: '', 
    login_start: '00:00', 
    login_end: '23:59',
    date: getTodayDate(),
    has_backend: true,
    has_frontend: true
  });

  const sortedModules = useMemo(() => {
    return [...modules].sort((a, b) => {
      const aName = String(a?.name || '').toLowerCase();
      const bName = String(b?.name || '').toLowerCase();
      return aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [modules]);

  const loadModules = async () => {
    setLoading(true);
    setError(null);
    try {
      let data = await fetchAllModules();
      // Ensure data is an array and filter out any null/undefined entries
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
  };

  useEffect(() => { loadModules(); }, []);

  const handleOpenModal = (mod = null) => {
    if (mod) {
      setEditingModule(mod.id);
      setFormData({
        name: mod.name,
        assignment_name: mod.assignment_name || '',
        assigned_leads: mod.assigned_leads.join(', '),
        login_start: mod.login_start || '00:00',
        login_end: mod.login_end || '23:59',
        date: mod.date || getTodayDate(),
        has_backend: mod.has_backend !== false,
        has_frontend: mod.has_frontend !== false
      });
    } else {
      setEditingModule(null);
      setFormData({ name: '', assignment_name: '', assigned_leads: '', login_start: '00:00', login_end: '23:59', date: getTodayDate(), has_backend: true, has_frontend: true });
    }
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      assignment_name: formData.assignment_name,
      week_num: editingModule
        ? (modules.find(m => m.id === editingModule)?.week_num || 1)
        : 1,
      assigned_leads: formData.assigned_leads.split(',').map(s => s.trim()).filter(Boolean),
      login_start: formData.login_start,
      login_end: formData.login_end,
      date: formData.date,
      has_backend: formData.has_backend,
      has_frontend: formData.has_frontend
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

  const confirmDelete = (id) => {
    setModuleToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (moduleToDelete) {
      await deleteModule(moduleToDelete);
      setDeleteConfirmOpen(false);
      setModuleToDelete(null);
      loadModules();
    }
  };

  const handleDuplicate = async (id) => {
    await duplicateModule(id);
    loadModules();
  };

  const csvEscape = (value) => {
    const str = value == null ? '' : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const formatChecklist = (obj) => {
    return Object.entries(obj || {})
      .map(([key, done]) => `${key}: ${done ? 'Completed' : 'Pending'}`)
      .join('\n');
  };

  const formatList = (arr) => (Array.isArray(arr) ? arr.join('\n') : '');

  const formatFeatures = (features) => {
    if (!Array.isArray(features) || features.length === 0) return '';
    return features
      .map(f => {
        const featureId = f?.id != null ? `#${f.id}` : 'NoId';
        const name = f?.name || 'Unnamed Feature';
        return `${featureId} ${name} (Backend: ${f?.backend ? 'Yes' : 'No'} | Frontend: ${f?.frontend ? 'Yes' : 'No'})`;
      })
      .join('\n');
  };

  const buildCsvFromModules = (modulesList) => {
    const headers = [
      'Module ID',
      'Module Name',
      'Assignment Name',
      'Week Number',
      'Date',
      'Login Start',
      'Login End',
      'Has Backend',
      'Has Frontend',
      'Assigned Leads',
      'Group ID',
      'Pair ID',
      'Roll Numbers',
      'Category',
      'Is Merged',
      'Partner Pair ID',
      'Overall Status',
      'Backend Files',
      'Backend API Endpoints',
      'Backend Functions',
      'Backend Architecture Match',
      'Backend Architecture Note',
      'Frontend Files',
      'Frontend Components',
      'Frontend Endpoints Integrated',
      'UI/UX Matches Fusion ERP',
      'Frontend Architecture Match',
      'Frontend Architecture Note',
      'Features Integration',
      'Notes & Observations',
      'Module Created At',
      'Module Updated At'
    ];

    let csv = headers.map(csvEscape).join(',') + '\n';

    modulesList.forEach((mod) => {
      if (!mod || !Array.isArray(mod.assigned_leads)) return;

      const groups = Array.isArray(mod.groups) ? mod.groups : [];
      if (groups.length === 0) {
        const row = [
          mod.id || mod._id || '',
          mod.name || '',
          mod.assignment_name || '',
          mod.week_num ?? '',
          mod.date || '',
          mod.login_start || '00:00',
          mod.login_end || '23:59',
          mod.has_backend !== false ? 'Yes' : 'No',
          mod.has_frontend !== false ? 'Yes' : 'No',
          mod.assigned_leads.join('; '),
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          mod.createdAt || '',
          mod.updatedAt || ''
        ];
        csv += row.map(csvEscape).join(',') + '\n';
        return;
      }

      groups.forEach((g) => {
        const evalData = g?.evaluation || {};
        const status = evalData?.is_functional ? 'Fully Functional' : 'Issues Detected';

        const row = [
          mod.id || mod._id || '',
          mod.name || '',
          mod.assignment_name || '',
          mod.week_num ?? '',
          mod.date || '',
          mod.login_start || '00:00',
          mod.login_end || '23:59',
          mod.has_backend !== false ? 'Yes' : 'No',
          mod.has_frontend !== false ? 'Yes' : 'No',
          mod.assigned_leads.join('; '),
          g?.id || g?._id || '',
          g?.pair_id || '',
          Array.isArray(g?.roll_numbers) ? g.roll_numbers.join('; ') : '',
          g?.category || '',
          g?.is_merged ? 'Yes' : 'No',
          g?.partner_pair_id || '',
          status,
          formatChecklist(evalData?.backend?.files),
          formatList(evalData?.backend?.endpoints),
          formatList(evalData?.backend?.functions),
          evalData?.backend?.architecture_matches_reference ? 'Yes' : 'No',
          evalData?.backend?.architecture_note || '',
          formatChecklist(evalData?.frontend?.files),
          formatList(evalData?.frontend?.components),
          formatList(evalData?.frontend?.endpoints_used),
          evalData?.frontend?.ui_ux_matches_fusion_erp ? 'Yes' : 'No',
          evalData?.frontend?.architecture_matches_reference ? 'Yes' : 'No',
          evalData?.frontend?.architecture_note || '',
          formatFeatures(evalData?.features),
          evalData?.notes || '',
          mod.createdAt || '',
          mod.updatedAt || ''
        ];

        csv += row.map(csvEscape).join(',') + '\n';
      });
    });

    return csv;
  };

  const exportAllToCSV = () => {
    if (!Array.isArray(modules) || modules.length === 0) {
      alert('No modules to export');
      return;
    }
    const csv = buildCsvFromModules(modules);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `all_modules_evaluation.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToCSV = (mod) => {
    if (!mod || !mod.groups || !mod.assigned_leads) {
      alert('Cannot export: Module data is incomplete');
      return;
    }
    const csv = buildCsvFromModules([mod]);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${mod.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_full_evaluation.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-8 flex justify-center text-gray-500">Loading Admin Dashboard...</div>;

  if (error) return <div className="p-8 flex justify-center text-red-600"><div className="bg-red-50 border border-red-200 rounded-lg p-4"><strong>Error:</strong> {error}</div></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Global Overview</h1>
          <p className="text-gray-500 mt-1">Admin Dashboard - Manage Modules & Assignments</p>
        </div>
        <div className="flex space-x-3">
          <button onClick={() => exportAllToCSV()} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center text-sm font-medium cursor-pointer transition-colors shadow-sm">
            <Download className="w-4 h-4 mr-2" /> Export All Data
          </button>
          {activeTab === 'modules' && (
            <button onClick={() => handleOpenModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center text-sm font-medium cursor-pointer transition-colors shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Create Module
            </button>
          )}
        </div>
      </header>
      
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('modules')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center cursor-pointer ${
              activeTab === 'modules'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Modules Overview
          </button>
          <button
            onClick={() => setActiveTab('leads')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center cursor-pointer ${
              activeTab === 'leads'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="w-4 h-4 mr-2" />
            Master Evaluation Data
          </button>
        </nav>
      </div>

      {activeTab === 'modules' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  <th className="px-6 py-4">Module</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Leads</th>
                  <th className="px-6 py-4">Access Window</th>
                  <th className="px-6 py-4">Progress</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedModules.map((mod, idx) => {
                  if (!mod || !mod.groups) {
                    return null;
                  }
                  const totalPairs = mod.groups.length;
                  const functionalPairs = mod.groups.filter(g => g.evaluation?.is_functional).length;
                  const progress = totalPairs > 0 ? Math.round((functionalPairs / totalPairs) * 100) : 0;

                  return (
                    <tr key={mod.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{mod.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{mod.assignment_name || `Week ${mod.week_num}`}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Calendar className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                          {mod.date || 'Not set'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {mod.assigned_leads.length > 0 ? mod.assigned_leads.join(', ') : <span className="italic text-gray-400">Unassigned</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                          {mod.login_start} - {mod.login_end}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                          </div>
                          <span className="text-xs text-gray-600 font-medium">{functionalPairs}/{totalPairs}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                        <button onClick={() => exportToCSV(mod)} className="text-emerald-600 hover:text-emerald-800 cursor-pointer p-1" title="Export to Excel"><Download className="w-4 h-4 inline" /></button>
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
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500 italic">No modules found. Create one to get started.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <MasterLeadsData onSelectModule={onSelectModule} />
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold mb-4">{editingModule ? 'Edit Module' : 'Create Module'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assignment Name</label>
                  <input required type="text" value={formData.assignment_name} onChange={e => setFormData({...formData, assignment_name: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" placeholder="e.g. Assignment 1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Leads (comma separated emails)</label>
                <input type="text" value={formData.assigned_leads} onChange={e => setFormData({...formData, assigned_leads: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" placeholder="lead1@example.com, lead2@example.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Login Start</label>
                  <input type="time" value={formData.login_start} onChange={e => setFormData({...formData, login_start: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Login End</label>
                  <input type="time" value={formData.login_end} onChange={e => setFormData({...formData, login_end: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={formData.has_backend} onChange={e => setFormData({...formData, has_backend: e.target.checked})} className="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-gray-700">Has Backend</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={formData.has_frontend} onChange={e => setFormData({...formData, has_frontend: e.target.checked})} className="rounded text-indigo-600 focus:ring-indigo-500" />
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
      
      <ConfirmModal 
        isOpen={deleteConfirmOpen}
        title="Delete Module"
        message="Are you sure you want to delete this module? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setModuleToDelete(null);
        }}
      />
    </div>
  );
}
