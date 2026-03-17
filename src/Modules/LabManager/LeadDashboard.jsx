import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchModuleDetails,
  updateEvaluation,
  createGroup,
  updateGroup,
  deleteGroup,
  duplicateGroup,
  createDivision,
  updateDivision,
  deleteDivision,
} from './api';
import FileChecklist from './components/FileChecklist';
import EditableList from './components/EditableList';
import ConfirmModal from './components/ConfirmModal';
import PromptModal from './components/PromptModal';
import FeatureList from './components/FeatureList';
import {
  ArrowLeft, Plus, Trash2, Code2, Link as LinkIcon, CheckCircle2, XCircle,
  Copy, Server, Layout, Edit2, Search, FolderOpen, ChevronDown, ChevronRight,
} from 'lucide-react';

// ── Sidebar helpers ────────────────────────────────────────────────────────────

function DivisionSection({ division, pairs, isAdmin, selectedGroupId, onSelectGroup, onAddPair, onRename, onDelete }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100 rounded-lg mb-1">
        <button
          onClick={() => setCollapsed(v => !v)}
          className="flex items-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-indigo-700 transition-colors"
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5 mr-1" />
            : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
          <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
          {division.name}
          <span className="ml-1.5 text-gray-400 font-normal normal-case">({pairs.length})</span>
        </button>
        {isAdmin && (
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onAddPair(division.id)}
              title={`Add pair to ${division.name}`}
              className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onRename(division)}
              title="Rename division"
              className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer transition-colors"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => onDelete(division)}
              title="Delete division"
              className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="space-y-1 pl-1">
          {pairs.map(group => (
            <PairCard
              key={group.id}
              group={group}
              selected={selectedGroupId === group.id}
              onClick={() => onSelectGroup(group.id)}
            />
          ))}
          {pairs.length === 0 && (
            <p className="text-xs text-gray-400 italic pl-3 py-1">No pairs in this division.</p>
          )}
        </div>
      )}
    </div>
  );
}

function PairCard({ group, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl cursor-pointer transition-all border ${selected ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'}`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className={`font-semibold text-sm ${selected ? 'text-indigo-900' : 'text-gray-900'}`}>{group.pair_id}</h3>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${group.category === 'AI' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
          {group.category}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">
          {group.evaluation?.features?.filter(f => f.is_functional).length || 0} / {group.evaluation?.features?.length || 0} Features
        </span>
        {group.evaluation?.is_functional ? (
          <span className="flex items-center text-emerald-600 font-medium"><CheckCircle2 className="w-3 h-3 mr-1" /> Functional</span>
        ) : (
          <span className="flex items-center text-red-500 font-medium"><XCircle className="w-3 h-3 mr-1" /> Issues</span>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LeadDashboard({ moduleId, user, onBack }) {
  const isAdmin = user?.role === 'admin';

  const [moduleData, setModuleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Pair modal states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [addPairModalOpen, setAddPairModalOpen] = useState(false);
  const [addPairDivisionId, setAddPairDivisionId] = useState(null);
  const [editPairModalOpen, setEditPairModalOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState(null);

  // Division modal states
  const [addDivisionModalOpen, setAddDivisionModalOpen] = useState(false);
  const [editDivisionModalOpen, setEditDivisionModalOpen] = useState(false);
  const [divisionToEdit, setDivisionToEdit] = useState(null);
  const [deleteDivisionConfirmOpen, setDeleteDivisionConfirmOpen] = useState(false);
  const [divisionToDelete, setDivisionToDelete] = useState(null);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadData = async ({ silent = false } = {}) => {
    if (!silent || !moduleData) setLoading(true);
    try {
      const data = await fetchModuleDetails(moduleId);
      if (data && typeof data === 'object' && Array.isArray(data.groups)) {
        setModuleData(data);
        // Auto-select first group only on initial load
        if (data.groups.length > 0 && !selectedGroupId) {
          setSelectedGroupId(data.groups[0].id);
        }
      } else {
        setModuleData(null);
      }
    } catch {
      if (!silent) setModuleData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [moduleId]);

  // ── Evaluation helpers ───────────────────────────────────────────────────────

  const parseRollNumbers = (raw) => {
    if (!raw || typeof raw !== 'string') return [];
    return raw.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  };

  const handleUpdateEval = async (groupId, newEval) => {
    setModuleData(prev => {
      const copy = { ...prev };
      const idx = copy.groups.findIndex(g => g.id === groupId);
      if (idx !== -1) copy.groups[idx] = { ...copy.groups[idx], evaluation: newEval };
      return copy;
    });
    try {
      await updateEvaluation(moduleId, groupId, newEval);
    } catch (err) {
      alert('Failed to save: ' + (err.message || 'Unknown error'));
      await loadData({ silent: true });
    }
  };

  const updateGroupSection = (group, section, key, value) => {
    const newEval = { ...group.evaluation };
    if (section) newEval[section] = { ...newEval[section], [key]: value };
    else newEval[key] = value;
    handleUpdateEval(group.id, newEval);
  };

  const handleUpdateRollNumbers = async (group, items) => {
    try {
      await updateGroup(moduleId, group.id, {
        pair_id: group.pair_id,
        category: group.category,
        roll_numbers: items,
      });
      await loadData({ silent: true });
    } catch (err) {
      alert(err.message || 'Failed to update roll numbers.');
    }
  };

  // ── Pair handlers ────────────────────────────────────────────────────────────

  const openAddPairModal = (divisionId = null) => {
    setAddPairDivisionId(divisionId);
    setAddPairModalOpen(true);
  };

  const handleAddGroupSubmit = async (formData) => {
    try {
      const newGroup = await createGroup(moduleId, {
        pair_id: formData.pairId,
        category: formData.category,
        roll_numbers: parseRollNumbers(formData.rollNumbers),
        division_id: formData.divisionId || addPairDivisionId || null,
      });
      setAddPairModalOpen(false);
      setAddPairDivisionId(null);
      await loadData({ silent: true });
      if (newGroup?.id) setSelectedGroupId(newGroup.id);
    } catch (err) {
      alert(err.message || 'Failed to add pair.');
    }
  };

  const handleEditGroupSubmit = async (formData) => {
    if (!groupToEdit) return;
    try {
      await updateGroup(moduleId, groupToEdit.id, {
        pair_id: formData.pairId,
        category: formData.category,
        roll_numbers: parseRollNumbers(formData.rollNumbers),
        ...(formData.divisionId !== undefined
          ? { division_id: formData.divisionId || null }
          : {}),
      });
      setEditPairModalOpen(false);
      setGroupToEdit(null);
      loadData({ silent: true });
    } catch (err) {
      alert(err.message || 'Failed to update pair.');
    }
  };

  const confirmDeleteGroup = (groupId) => { setGroupToDelete(groupId); setDeleteConfirmOpen(true); };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    try {
      await deleteGroup(moduleId, groupToDelete);
      if (selectedGroupId === groupToDelete) setSelectedGroupId(null);
    } catch (err) {
      alert(err.message || 'Failed to delete pair.');
    } finally {
      setDeleteConfirmOpen(false);
      setGroupToDelete(null);
      loadData({ silent: true });
    }
  };

  const handleDuplicateGroup = async (groupId) => {
    try {
      const newGroup = await duplicateGroup(moduleId, groupId);
      await loadData({ silent: true });
      if (newGroup?.id) setSelectedGroupId(newGroup.id);
    } catch (err) {
      alert(err.message || 'Failed to duplicate pair.');
    }
  };

  // ── Division handlers ────────────────────────────────────────────────────────

  const handleAddDivisionSubmit = async (formData) => {
    try {
      await createDivision(moduleId, { name: formData.name });
      setAddDivisionModalOpen(false);
      await loadData({ silent: true });
    } catch (err) {
      alert(err.message || 'Failed to create division.');
    }
  };

  const openRenameDivision = (division) => {
    setDivisionToEdit(division);
    setEditDivisionModalOpen(true);
  };

  const handleRenameDivisionSubmit = async (formData) => {
    if (!divisionToEdit) return;
    try {
      await updateDivision(moduleId, divisionToEdit.id, { name: formData.name });
      setEditDivisionModalOpen(false);
      setDivisionToEdit(null);
      await loadData({ silent: true });
    } catch (err) {
      alert(err.message || 'Failed to rename division.');
    }
  };

  const confirmDeleteDivision = (division) => {
    setDivisionToDelete(division);
    setDeleteDivisionConfirmOpen(true);
  };

  const handleDeleteDivision = async () => {
    if (!divisionToDelete) return;
    try {
      await deleteDivision(moduleId, divisionToDelete.id);
    } catch (err) {
      alert(err.message || 'Failed to delete division.');
    } finally {
      setDeleteDivisionConfirmOpen(false);
      setDivisionToDelete(null);
      await loadData({ silent: true });
    }
  };

  // ── Derived data ─────────────────────────────────────────────────────────────

  const divisions = useMemo(() => Array.isArray(moduleData?.divisions) ? moduleData.divisions : [], [moduleData]);

  const divisionOptions = useMemo(() =>
    [{ label: 'No Division (ungrouped)', value: '' },
    ...divisions.map(d => ({ label: d.name, value: d.id }))],
  [divisions]);

  const ungroupedPairs = useMemo(() =>
    (moduleData?.groups || []).filter(g => !g.division_id),
  [moduleData]);

  const pairsByDivision = useMemo(() => {
    const map = {};
    for (const d of divisions) {
      map[d.id] = (moduleData?.groups || []).filter(g => g.division_id === d.id);
    }
    return map;
  }, [divisions, moduleData]);

  // Flat filtered list for search (used to highlight / find pairs)
  const allGroups = moduleData?.groups || [];
  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return allGroups;
    return allGroups.filter(g =>
      g.pair_id.toLowerCase().includes(q) || g.category.toLowerCase().includes(q)
    );
  }, [allGroups, searchQuery]);

  // Derive which pairs to show per division when search is active
  const visiblePairsByDivision = useMemo(() => {
    const filteredIds = new Set(filteredGroups.map(g => g.id));
    const map = {};
    for (const d of divisions) {
      map[d.id] = (pairsByDivision[d.id] || []).filter(g => filteredIds.has(g.id));
    }
    return map;
  }, [divisions, pairsByDivision, filteredGroups]);

  const visibleUngrouped = useMemo(() => {
    const filteredIds = new Set(filteredGroups.map(g => g.id));
    return ungroupedPairs.filter(g => filteredIds.has(g.id));
  }, [ungroupedPairs, filteredGroups]);

  const selectedGroup = allGroups.find(g => g.id === selectedGroupId);

  // ── Render guards ─────────────────────────────────────────────────────────────

  if (loading && !moduleData) return <div className="p-8 flex justify-center text-gray-500">Loading Module Details...</div>;
  if (!moduleData) return <div className="p-8 flex justify-center text-red-500">Module not found.</div>;
  if (!Array.isArray(moduleData.groups)) return <div className="p-8 flex justify-center text-red-500">Invalid module data.</div>;

  const hasDivisions = divisions.length > 0;

  return (
    <div className="flex flex-col h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shrink-0">
        <div>
          {onBack && (
            <button onClick={onBack} className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 mb-1 transition-colors cursor-pointer">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Modules
            </button>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{moduleData.name}</h1>
          <p className="text-xs text-gray-500 mt-0.5">Domain Lead Evaluation Dashboard</p>
        </div>
        <div className="flex items-center space-x-2">
          {isAdmin && (
            <button
              onClick={() => setAddDivisionModalOpen(true)}
              className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center text-sm font-medium cursor-pointer transition-colors shadow-sm"
            >
              <FolderOpen className="w-4 h-4 mr-1.5" /> Add Division
            </button>
          )}
          <button
            onClick={() => openAddPairModal(null)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center text-sm font-medium transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Pair
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search pairs…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Divisions + their pairs */}
            {hasDivisions && divisions.map(div => {
              const pairs = visiblePairsByDivision[div.id] || [];
              // Hide empty divisions when searching
              if (searchQuery && pairs.length === 0) return null;
              return (
                <DivisionSection
                  key={div.id}
                  division={div}
                  pairs={pairs}
                  isAdmin={isAdmin}
                  selectedGroupId={selectedGroupId}
                  onSelectGroup={setSelectedGroupId}
                  onAddPair={openAddPairModal}
                  onRename={openRenameDivision}
                  onDelete={confirmDeleteDivision}
                />
              );
            })}

            {/* Ungrouped pairs */}
            {visibleUngrouped.length > 0 && (
              <div>
                {hasDivisions && (
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100 rounded-lg mb-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Ungrouped
                      <span className="ml-1.5 text-gray-400 font-normal normal-case">({visibleUngrouped.length})</span>
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => openAddPairModal(null)}
                        title="Add ungrouped pair"
                        className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
                <div className="space-y-1 pl-1">
                  {visibleUngrouped.map(group => (
                    <PairCard
                      key={group.id}
                      group={group}
                      selected={selectedGroupId === group.id}
                      onClick={() => setSelectedGroupId(group.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredGroups.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                {searchQuery ? 'No pairs match your search.' : 'No pairs added yet.'}
              </div>
            )}
          </div>
        </div>

        {/* Evaluation Details */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {selectedGroup ? (
            <div className="max-w-5xl mx-auto space-y-6">

              {/* Pair Header */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center space-x-3 mb-1">
                    <h2 className="text-2xl font-bold text-gray-900">{selectedGroup.pair_id}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${selectedGroup.category === 'AI' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                      {selectedGroup.category}
                    </span>
                    {selectedGroup.is_merged && (
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        Merged: {selectedGroup.partner_pair_id}
                      </span>
                    )}
                    {selectedGroup.division_id && (
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full flex items-center">
                        <FolderOpen className="w-3 h-3 mr-1" />
                        {divisions.find(d => d.id === selectedGroup.division_id)?.name || '—'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">Evaluate and track progress for this pair.</p>
                </div>

                <div className="flex items-center space-x-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                  <button
                    onClick={() => updateGroupSection(selectedGroup, null, 'is_functional', !selectedGroup.evaluation.is_functional)}
                    className={`flex items-center text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer ${selectedGroup.evaluation.is_functional ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200' : 'text-red-700 bg-red-100 hover:bg-red-200'}`}
                  >
                    {selectedGroup.evaluation.is_functional
                      ? <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Fully Functional</>
                      : <><XCircle className="w-4 h-4 mr-1.5" /> Issues Detected</>}
                  </button>
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  <button onClick={() => { setGroupToEdit(selectedGroup); setEditPairModalOpen(true); }} className="text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer p-2 rounded-md transition-colors" title="Edit Pair"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDuplicateGroup(selectedGroup.id)} className="text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer p-2 rounded-md transition-colors" title="Duplicate Pair"><Copy className="w-4 h-4" /></button>
                  <button onClick={() => confirmDeleteGroup(selectedGroup.id)} className="text-gray-500 hover:text-red-600 hover:bg-red-50 cursor-pointer p-2 rounded-md transition-colors" title="Delete Pair"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Implementation Grid */}
              <div className={`grid grid-cols-1 ${moduleData.has_backend && moduleData.has_frontend ? 'xl:grid-cols-2' : ''} gap-6`}>
                <div className="xl:col-span-2">
                  <EditableList
                    title="Roll Numbers"
                    items={selectedGroup.roll_numbers || []}
                    onUpdate={items => handleUpdateRollNumbers(selectedGroup, items)}
                  />
                </div>

                {moduleData.has_backend && (
                  <div className="space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-slate-800 flex items-center text-lg border-b border-gray-100 pb-3"><Server className="w-5 h-5 mr-2 text-indigo-600" /> Backend Implementation</h3>
                    <FileChecklist title="Backend Files" files={selectedGroup.evaluation.backend?.files || {}} onUpdate={files => updateGroupSection(selectedGroup, 'backend', 'files', files)} />
                    <EditableList title="URL Endpoints" items={selectedGroup.evaluation.backend?.endpoints || []} onUpdate={items => updateGroupSection(selectedGroup, 'backend', 'endpoints', items)} icon={LinkIcon} />
                    <EditableList title="Functions Detected" items={selectedGroup.evaluation.backend?.functions || []} onUpdate={items => updateGroupSection(selectedGroup, 'backend', 'functions', items)} icon={Code2} />
                    <div className="border border-gray-200 rounded-xl p-4 bg-slate-50 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Backend Architecture Match</h4>
                          <p className="text-xs text-gray-500 mt-1">Is the backend implemented in the given backend architecture?</p>
                        </div>
                        <button
                          onClick={() => updateGroupSection(selectedGroup, 'backend', 'architecture_matches_reference', !selectedGroup.evaluation.backend?.architecture_matches_reference)}
                          className={`flex items-center text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer ${selectedGroup.evaluation.backend?.architecture_matches_reference ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200' : 'text-red-700 bg-red-100 hover:bg-red-200'}`}
                        >
                          {selectedGroup.evaluation.backend?.architecture_matches_reference
                            ? <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Matching</>
                            : <><XCircle className="w-4 h-4 mr-1.5" /> Not Matching</>}
                        </button>
                      </div>
                      <div>
                        <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Backend Architecture Note</h5>
                        <textarea value={selectedGroup.evaluation.backend?.architecture_note || ''} onChange={e => updateGroupSection(selectedGroup, 'backend', 'architecture_note', e.target.value)} placeholder="Add backend architecture notes…" className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[90px] resize-y bg-white" />
                      </div>
                    </div>
                  </div>
                )}

                {moduleData.has_frontend && (
                  <div className="space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-slate-800 flex items-center text-lg border-b border-gray-100 pb-3"><Layout className="w-5 h-5 mr-2 text-indigo-600" /> Frontend Implementation</h3>
                    <FileChecklist title="Frontend Files" files={selectedGroup.evaluation.frontend?.files || {}} onUpdate={files => updateGroupSection(selectedGroup, 'frontend', 'files', files)} />
                    <EditableList title="Endpoints Integrated" items={selectedGroup.evaluation.frontend?.endpoints_used || []} onUpdate={items => updateGroupSection(selectedGroup, 'frontend', 'endpoints_used', items)} icon={LinkIcon} />
                    <div className="border border-gray-200 rounded-xl p-4 bg-slate-50">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">UI/UX Alignment</h4>
                          <p className="text-xs text-gray-500 mt-1">Matches the existing Fusion ERP application design and interaction style.</p>
                        </div>
                        <button
                          onClick={() => updateGroupSection(selectedGroup, 'frontend', 'ui_ux_matches_fusion_erp', !selectedGroup.evaluation.frontend?.ui_ux_matches_fusion_erp)}
                          className={`flex items-center text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer ${selectedGroup.evaluation.frontend?.ui_ux_matches_fusion_erp ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200' : 'text-red-700 bg-red-100 hover:bg-red-200'}`}
                        >
                          {selectedGroup.evaluation.frontend?.ui_ux_matches_fusion_erp
                            ? <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Matching</>
                            : <><XCircle className="w-4 h-4 mr-1.5" /> Not Matching</>}
                        </button>
                      </div>
                    </div>
                    <div className="border border-gray-200 rounded-xl p-4 bg-slate-50 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Frontend Architecture Match</h4>
                          <p className="text-xs text-gray-500 mt-1">Is the frontend implemented in the given frontend architecture?</p>
                        </div>
                        <button
                          onClick={() => updateGroupSection(selectedGroup, 'frontend', 'architecture_matches_reference', !selectedGroup.evaluation.frontend?.architecture_matches_reference)}
                          className={`flex items-center text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer ${selectedGroup.evaluation.frontend?.architecture_matches_reference ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200' : 'text-red-700 bg-red-100 hover:bg-red-200'}`}
                        >
                          {selectedGroup.evaluation.frontend?.architecture_matches_reference
                            ? <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Matching</>
                            : <><XCircle className="w-4 h-4 mr-1.5" /> Not Matching</>}
                        </button>
                      </div>
                      <div>
                        <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Frontend Architecture Note</h5>
                        <textarea value={selectedGroup.evaluation.frontend?.architecture_note || ''} onChange={e => updateGroupSection(selectedGroup, 'frontend', 'architecture_note', e.target.value)} placeholder="Add frontend architecture notes…" className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[90px] resize-y bg-white" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <FeatureList
                  features={selectedGroup.evaluation.features || []}
                  onUpdate={features => updateGroupSection(selectedGroup, null, 'features', features)}
                  hasBackend={moduleData.has_backend !== false}
                  hasFrontend={moduleData.has_frontend !== false}
                />
              </div>

              {/* Notes */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Notes &amp; Observations</h3>
                <textarea
                  value={selectedGroup.evaluation.notes || ''}
                  onChange={e => updateGroupSection(selectedGroup, null, 'notes', e.target.value)}
                  placeholder="Add any notes, issues, or observations here…"
                  className="w-full border border-gray-200 rounded-xl p-4 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[120px] resize-y bg-gray-50"
                />
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <Layout className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-500">Select a pair to view details</p>
              <p className="text-sm mt-2">Or click "Add Pair" to create a new one.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Division Modal ── */}
      <PromptModal
        isOpen={addDivisionModalOpen}
        title="Add Group Division"
        fields={[
          { name: 'name', label: 'Division Name (e.g. G1, Group A)', required: true, placeholder: 'G1' },
        ]}
        onSubmit={handleAddDivisionSubmit}
        onCancel={() => setAddDivisionModalOpen(false)}
      />

      {/* ── Rename Division Modal ── */}
      <PromptModal
        isOpen={editDivisionModalOpen}
        title="Rename Division"
        fields={[
          { name: 'name', label: 'Division Name', required: true, defaultValue: divisionToEdit?.name },
        ]}
        onSubmit={handleRenameDivisionSubmit}
        onCancel={() => { setEditDivisionModalOpen(false); setDivisionToEdit(null); }}
      />

      {/* ── Add Pair Modal ── */}
      <PromptModal
        isOpen={addPairModalOpen}
        title="Add New Pair"
        fields={[
          { name: 'pairId', label: 'Pair ID (e.g., Pair 1)', required: true, placeholder: 'Pair 1' },
          { name: 'rollNumbers', label: 'Roll Numbers (comma or newline separated)', type: 'textarea', required: false, placeholder: '23bcs001, 23bcs002' },
          { name: 'category', label: 'Category', type: 'select', required: true, defaultValue: 'CONV', options: [{ label: 'Conventional (CONV)', value: 'CONV' }, { label: 'AI', value: 'AI' }] },
          ...(divisions.length > 0 ? [{
            name: 'divisionId', label: 'Division', type: 'select', required: false,
            defaultValue: addPairDivisionId || '',
            options: divisionOptions,
          }] : []),
        ]}
        onSubmit={handleAddGroupSubmit}
        onCancel={() => { setAddPairModalOpen(false); setAddPairDivisionId(null); }}
      />

      {/* ── Edit Pair Modal ── */}
      <PromptModal
        isOpen={editPairModalOpen}
        title="Edit Pair"
        fields={[
          { name: 'pairId', label: 'Pair ID', required: true, defaultValue: groupToEdit?.pair_id },
          { name: 'rollNumbers', label: 'Roll Numbers', type: 'textarea', required: false, defaultValue: (groupToEdit?.roll_numbers || []).join(', ') },
          { name: 'category', label: 'Category', type: 'select', required: true, defaultValue: groupToEdit?.category, options: [{ label: 'Conventional (CONV)', value: 'CONV' }, { label: 'AI', value: 'AI' }] },
          ...(divisions.length > 0 ? [{
            name: 'divisionId', label: 'Division', type: 'select', required: false,
            defaultValue: groupToEdit?.division_id || '',
            options: divisionOptions,
          }] : []),
        ]}
        onSubmit={handleEditGroupSubmit}
        onCancel={() => { setEditPairModalOpen(false); setGroupToEdit(null); }}
      />

      {/* ── Delete Pair Confirm ── */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Pair"
        message="Are you sure you want to delete this pair? All evaluation data will be lost."
        onConfirm={handleDeleteGroup}
        onCancel={() => { setDeleteConfirmOpen(false); setGroupToDelete(null); }}
      />

      {/* ── Delete Division Confirm ── */}
      <ConfirmModal
        isOpen={deleteDivisionConfirmOpen}
        title="Delete Division"
        message={`Delete division "${divisionToDelete?.name}"? Pairs inside will become ungrouped — no evaluation data will be lost.`}
        onConfirm={handleDeleteDivision}
        onCancel={() => { setDeleteDivisionConfirmOpen(false); setDivisionToDelete(null); }}
      />
    </div>
  );
}
