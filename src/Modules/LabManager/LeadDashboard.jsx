import React, { useState, useEffect } from 'react';
import { fetchModuleDetails, updateEvaluation, createGroup, deleteGroup, duplicateGroup, updateGroup } from './api';
import FileChecklist from './components/FileChecklist';
import EditableList from './components/EditableList';
import ConfirmModal from './components/ConfirmModal';
import PromptModal from './components/PromptModal';
import FeatureList from './components/FeatureList';
import { ArrowLeft, Plus, Trash2, Code2, Link as LinkIcon, CheckCircle2, XCircle, Copy, Server, Layout, Edit2, Search } from 'lucide-react';

export default function LeadDashboard({ moduleId, onBack }) {
  const [moduleData, setModuleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [addPairModalOpen, setAddPairModalOpen] = useState(false);
  const [editPairModalOpen, setEditPairModalOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState(null);

  const loadData = async ({ silent = false } = {}) => {
    if (!silent || !moduleData) {
      setLoading(true);
    }
    try {
      const data = await fetchModuleDetails(moduleId);
      if (data && typeof data === 'object' && Array.isArray(data.groups)) {
        setModuleData(data);
        if (data.groups.length > 0 && !selectedGroupId) {
          setSelectedGroupId(data.groups[0].id);
        }
      } else {
        setModuleData(null);
      }
    } catch (err) {
      if (!silent) {
        setModuleData(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [moduleId]);

  const parseRollNumbers = (raw) => {
    if (!raw || typeof raw !== 'string') return [];
    return raw
      .split(/[\n,]/)
      .map(item => item.trim())
      .filter(Boolean);
  };

  const handleUpdateEval = async (groupId, newEvaluation) => {
    // Optimistic update
    setModuleData(prev => {
      const newData = { ...prev };
      const gIndex = newData.groups.findIndex(g => g.id === groupId);
      newData.groups[gIndex].evaluation = newEvaluation;
      return newData;
    });
    try {
      await updateEvaluation(moduleId, groupId, newEvaluation);
    } catch (err) {
      alert('Failed to save: ' + (err.message || 'Unknown error'));
      // Reload to reset optimistic update
      await loadData({ silent: true });
    }
  };

  const updateGroupSection = (group, section, key, value) => {
    const newEval = { ...group.evaluation };
    if (section) {
      newEval[section] = { ...newEval[section], [key]: value };
    } else {
      newEval[key] = value;
    }
    handleUpdateEval(group.id, newEval);
  };

  const handleAddGroupSubmit = async (formData) => {
    try {
      const newGroup = await createGroup(moduleId, {
        pair_id: formData.pairId,
        category: formData.category,
        roll_numbers: parseRollNumbers(formData.rollNumbers),
      });
      setAddPairModalOpen(false);
      await loadData({ silent: true });
      if (newGroup) setSelectedGroupId(newGroup.id);
    } catch (err) {
      alert(err.message || 'Failed to add pair.');
    }
  };

  const handleEditGroupSubmit = async (formData) => {
    if (groupToEdit) {
      try {
        await updateGroup(moduleId, groupToEdit.id, {
          pair_id: formData.pairId,
          category: formData.category,
          roll_numbers: parseRollNumbers(formData.rollNumbers),
        });
        setEditPairModalOpen(false);
        setGroupToEdit(null);
        loadData({ silent: true });
      } catch (err) {
        alert(err.message || 'Failed to update pair.');
      }
    }
  };

  const openEditModal = (group) => {
    setGroupToEdit(group);
    setEditPairModalOpen(true);
  };

  const confirmDeleteGroup = (groupId) => {
    setGroupToDelete(groupId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteGroup = async () => {
    if (groupToDelete) {
      try {
        await deleteGroup(moduleId, groupToDelete);
        setDeleteConfirmOpen(false);
        if (selectedGroupId === groupToDelete) {
          setSelectedGroupId(null);
        }
        setGroupToDelete(null);
        loadData({ silent: true });
      } catch (err) {
        alert(err.message || 'Failed to delete pair.');
      }
    }
  };

  const handleDuplicateGroup = async (groupId) => {
    try {
      const newGroup = await duplicateGroup(moduleId, groupId);
      await loadData({ silent: true });
      if (newGroup) setSelectedGroupId(newGroup.id);
    } catch (err) {
      alert(err.message || 'Failed to duplicate pair.');
    }
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

  if (loading && !moduleData) return <div className="p-8 flex justify-center text-gray-500">Loading Module Details...</div>;
  if (!moduleData) return <div className="p-8 flex justify-center text-red-500">Module not found.</div>;
  
  if (!Array.isArray(moduleData.groups)) {
    return <div className="p-8 flex justify-center text-red-500">Invalid module data: groups not accessible.</div>;
  }

  const filteredGroups = moduleData.groups.filter(g => 
    g.pair_id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    g.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedGroup = moduleData.groups.find(g => g.id === selectedGroupId);

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
        <button onClick={() => setAddPairModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center text-sm font-medium transition-colors cursor-pointer shadow-sm">
          <Plus className="w-4 h-4 mr-2" /> Add Pair
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar - Pair List */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search pairs..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredGroups.map(group => (
              <div 
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                className={`p-3 rounded-xl cursor-pointer transition-all border ${selectedGroupId === group.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className={`font-semibold ${selectedGroupId === group.id ? 'text-indigo-900' : 'text-gray-900'}`}>{group.pair_id}</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${group.category === 'AI' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {group.category}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    {group.evaluation?.features?.filter(f => f.is_functional).length || 0} / {group.evaluation?.features?.length || 0} Features
                  </span>
                  {group.evaluation?.is_functional ? (
                    <span className="flex items-center text-emerald-600 font-medium"><CheckCircle2 className="w-3 h-3 mr-1"/> Functional</span>
                  ) : (
                    <span className="flex items-center text-red-500 font-medium"><XCircle className="w-3 h-3 mr-1"/> Issues</span>
                  )}
                </div>
              </div>
            ))}
            {filteredGroups.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                {searchQuery ? 'No pairs match your search.' : 'No pairs added yet.'}
              </div>
            )}
          </div>
        </div>

        {/* Evaluation Details Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {selectedGroup ? (
            <div className="max-w-5xl mx-auto space-y-6">
              
              {/* Pair Header Card */}
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
                  </div>
                  <p className="text-sm text-gray-500">Evaluate and track progress for this pair.</p>
                </div>
                
                <div className="flex items-center space-x-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                  <button 
                    onClick={() => updateGroupSection(selectedGroup, null, 'is_functional', !selectedGroup.evaluation.is_functional)}
                    className={`flex items-center text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer ${selectedGroup.evaluation.is_functional ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200' : 'text-red-700 bg-red-100 hover:bg-red-200'}`}
                  >
                    {selectedGroup.evaluation.is_functional ? <><CheckCircle2 className="w-4 h-4 mr-1.5"/> Fully Functional</> : <><XCircle className="w-4 h-4 mr-1.5"/> Issues Detected</>}
                  </button>
                  <div className="w-px h-6 bg-gray-300 mx-1"></div>
                  <button onClick={() => openEditModal(selectedGroup)} className="text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer p-2 rounded-md transition-colors" title="Edit Pair"><Edit2 className="w-4 h-4" /></button>
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
                    onUpdate={(items) => handleUpdateRollNumbers(selectedGroup, items)}
                  />
                </div>
                {/* Backend Section */}
                {moduleData.has_backend && (
                  <div className="space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-slate-800 flex items-center text-lg border-b border-gray-100 pb-3"><Server className="w-5 h-5 mr-2 text-indigo-600"/> Backend Implementation</h3>
                    <FileChecklist 
                      title="Backend Files" 
                      files={selectedGroup.evaluation.backend?.files || {}} 
                      onUpdate={(files) => updateGroupSection(selectedGroup, 'backend', 'files', files)} 
                    />
                    <EditableList 
                      title="URL's Endpoints" 
                      items={selectedGroup.evaluation.backend?.endpoints || []} 
                      onUpdate={(items) => updateGroupSection(selectedGroup, 'backend', 'endpoints', items)} 
                      icon={LinkIcon}
                    />
                    <EditableList 
                      title="Functions Detected" 
                      items={selectedGroup.evaluation.backend?.functions || []} 
                      onUpdate={(items) => updateGroupSection(selectedGroup, 'backend', 'functions', items)} 
                      icon={Code2}
                    />
                    <div className="border border-gray-200 rounded-xl p-4 bg-slate-50 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Backend Architecture Match</h4>
                          <p className="text-xs text-gray-500 mt-1">Is the backend implemented in the given backend architecture?</p>
                        </div>
                        <button
                          onClick={() => updateGroupSection(
                            selectedGroup,
                            'backend',
                            'architecture_matches_reference',
                            !selectedGroup.evaluation.backend?.architecture_matches_reference
                          )}
                          className={`flex items-center text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer ${selectedGroup.evaluation.backend?.architecture_matches_reference ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200' : 'text-red-700 bg-red-100 hover:bg-red-200'}`}
                        >
                          {selectedGroup.evaluation.backend?.architecture_matches_reference ? (
                            <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Matching</>
                          ) : (
                            <><XCircle className="w-4 h-4 mr-1.5" /> Not Matching</>
                          )}
                        </button>
                      </div>
                      <div>
                        <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Backend Architecture Note</h5>
                        <textarea
                          value={selectedGroup.evaluation.backend?.architecture_note || ''}
                          onChange={(e) => updateGroupSection(selectedGroup, 'backend', 'architecture_note', e.target.value)}
                          placeholder="Add backend architecture notes..."
                          className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[90px] resize-y bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Frontend Section */}
                {moduleData.has_frontend && (
                  <div className="space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-slate-800 flex items-center text-lg border-b border-gray-100 pb-3"><Layout className="w-5 h-5 mr-2 text-indigo-600"/> Frontend Implementation</h3>
                    <FileChecklist 
                      title="Frontend Files" 
                      files={selectedGroup.evaluation.frontend?.files || {}} 
                      onUpdate={(files) => updateGroupSection(selectedGroup, 'frontend', 'files', files)} 
                    />
                    <EditableList 
                      title="Components List" 
                      items={selectedGroup.evaluation.frontend?.components || []} 
                      onUpdate={(items) => updateGroupSection(selectedGroup, 'frontend', 'components', items)} 
                      icon={Layout}
                    />
                    <EditableList 
                      title="Endpoints Integrated" 
                      items={selectedGroup.evaluation.frontend?.endpoints_used || []} 
                      onUpdate={(items) => updateGroupSection(selectedGroup, 'frontend', 'endpoints_used', items)} 
                      icon={LinkIcon}
                    />
                    <div className="border border-gray-200 rounded-xl p-4 bg-slate-50">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">UI/UX Alignment</h4>
                          <p className="text-xs text-gray-500 mt-1">Matches the existing Fusion ERP application design and interaction style.</p>
                        </div>
                        <button
                          onClick={() => updateGroupSection(
                            selectedGroup,
                            'frontend',
                            'ui_ux_matches_fusion_erp',
                            !selectedGroup.evaluation.frontend?.ui_ux_matches_fusion_erp
                          )}
                          className={`flex items-center text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer ${selectedGroup.evaluation.frontend?.ui_ux_matches_fusion_erp ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200' : 'text-red-700 bg-red-100 hover:bg-red-200'}`}
                        >
                          {selectedGroup.evaluation.frontend?.ui_ux_matches_fusion_erp ? (
                            <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Matching</>
                          ) : (
                            <><XCircle className="w-4 h-4 mr-1.5" /> Not Matching</>
                          )}
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
                          onClick={() => updateGroupSection(
                            selectedGroup,
                            'frontend',
                            'architecture_matches_reference',
                            !selectedGroup.evaluation.frontend?.architecture_matches_reference
                          )}
                          className={`flex items-center text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer ${selectedGroup.evaluation.frontend?.architecture_matches_reference ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200' : 'text-red-700 bg-red-100 hover:bg-red-200'}`}
                        >
                          {selectedGroup.evaluation.frontend?.architecture_matches_reference ? (
                            <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Matching</>
                          ) : (
                            <><XCircle className="w-4 h-4 mr-1.5" /> Not Matching</>
                          )}
                        </button>
                      </div>
                      <div>
                        <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Frontend Architecture Note</h5>
                        <textarea
                          value={selectedGroup.evaluation.frontend?.architecture_note || ''}
                          onChange={(e) => updateGroupSection(selectedGroup, 'frontend', 'architecture_note', e.target.value)}
                          placeholder="Add frontend architecture notes..."
                          className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[90px] resize-y bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Features Section */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <FeatureList 
                  features={selectedGroup.evaluation.features || []} 
                  onUpdate={(features) => updateGroupSection(selectedGroup, null, 'features', features)} 
                  hasBackend={moduleData.has_backend !== false}
                  hasFrontend={moduleData.has_frontend !== false}
                />
              </div>

              {/* Notes Section */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Notes & Observations</h3>
                <textarea
                  value={selectedGroup.evaluation.notes || ''}
                  onChange={(e) => updateGroupSection(selectedGroup, null, 'notes', e.target.value)}
                  placeholder="Add any notes, issues, or observations here..."
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

      <PromptModal
        isOpen={addPairModalOpen}
        title="Add New Pair"
        fields={[
          { name: 'pairId', label: 'Pair ID (e.g., Pair 1)', required: true, placeholder: 'Pair 1' },
          { name: 'rollNumbers', label: 'Roll Numbers (comma or new line separated)', type: 'textarea', required: false, placeholder: '23bcs001, 23bcs002' },
          { name: 'category', label: 'Category', type: 'select', required: true, defaultValue: 'CONV', options: [{label: 'Conventional (CONV)', value: 'CONV'}, {label: 'AI', value: 'AI'}] }
        ]}
        onSubmit={handleAddGroupSubmit}
        onCancel={() => setAddPairModalOpen(false)}
      />

      <PromptModal
        isOpen={editPairModalOpen}
        title="Edit Pair"
        fields={[
          { name: 'pairId', label: 'Pair ID (e.g., Pair 1)', required: true, defaultValue: groupToEdit?.pair_id },
          { name: 'rollNumbers', label: 'Roll Numbers (comma or new line separated)', type: 'textarea', required: false, defaultValue: (groupToEdit?.roll_numbers || []).join(', ') },
          { name: 'category', label: 'Category', type: 'select', required: true, defaultValue: groupToEdit?.category, options: [{label: 'Conventional (CONV)', value: 'CONV'}, {label: 'AI', value: 'AI'}] }
        ]}
        onSubmit={handleEditGroupSubmit}
        onCancel={() => {
          setEditPairModalOpen(false);
          setGroupToEdit(null);
        }}
      />

      <ConfirmModal 
        isOpen={deleteConfirmOpen}
        title="Delete Pair"
        message="Are you sure you want to delete this pair? All evaluation data will be lost."
        onConfirm={handleDeleteGroup}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setGroupToDelete(null);
        }}
      />
    </div>
  );
}
