import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  fetchModuleDetails,
  fetchModuleSpecifications,
  updateEvaluation,
  createGroup,
  updateGroup,
  deleteGroup,
  duplicateGroup,
  createDivision,
  updateDivision,
  deleteDivision,
  saveModuleSpecifications,
  uploadModuleSpecsZip,
} from './api';
import FileChecklist from './components/FileChecklist';
import EditableList from './components/EditableList';
import ConfirmModal from './components/ConfirmModal';
import PromptModal from './components/PromptModal';
import FeatureList from './components/FeatureList';
import ModuleSpecifications from './components/ModuleSpecifications';
import {
  ArrowLeft, Plus, Trash2, Code2, Link as LinkIcon, CheckCircle2, XCircle,
  Copy, Server, Layout, Edit2, Search, FolderOpen, ChevronDown, ChevronRight, Upload, Download, Save,
} from 'lucide-react';

// ── Sidebar helpers ────────────────────────────────────────────────────────────

function DivisionSection({
  division,
  pairs,
  isAdmin,
  selectedGroupId,
  onSelectGroup,
  onAddPair,
  onRename,
  onDelete,
  canMovePairs,
  isDropActive,
  onDragEnterZone,
  onDropGroup,
  onPairDragStart,
  onPairDragEnd,
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`rounded-lg ${isDropActive ? 'ring-2 ring-indigo-200 bg-indigo-50/30' : ''}`}
      onDragEnter={canMovePairs ? () => onDragEnterZone(division.id) : undefined}
      onDragOver={canMovePairs ? (e) => { e.preventDefault(); } : undefined}
      onDrop={canMovePairs ? (e) => { e.preventDefault(); onDropGroup(division.id); } : undefined}
    >
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
              draggable={canMovePairs}
              onDragStart={() => onPairDragStart(group.id)}
              onDragEnd={onPairDragEnd}
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

function PairCard({ group, selected, onClick, draggable = false, onDragStart, onDragEnd }) {
  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
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
    const byNaturalLabel = (a, b) =>
      String(a || '').localeCompare(String(b || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      });

  const isAdmin = user?.role === 'admin';
  const canEditSpecifications = isAdmin || user?.role === 'lead';

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
  const [draggedGroupId, setDraggedGroupId] = useState(null);
  const [dragOverZone, setDragOverZone] = useState(null);
  const [primaryView, setPrimaryView] = useState('evaluation');
  const [sideBySide, setSideBySide] = useState(false);
  const [specAutoSaveStatus, setSpecAutoSaveStatus] = useState('idle');
  const [zipUploadStatus, setZipUploadStatus] = useState('idle');
  const [zipUploadProgress, setZipUploadProgress] = useState(0);
  const [zipUploadFileName, setZipUploadFileName] = useState('');
  const [specHasUnsavedChanges, setSpecHasUnsavedChanges] = useState(false);
  const [specPanelSaving, setSpecPanelSaving] = useState(false);
  const [sidebarPeekOpen, setSidebarPeekOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaveReason, setLeaveReason] = useState('leave this page');
  const [toast, setToast] = useState({ open: false, type: 'info', message: '' });
  const specsUploadInputRef = useRef(null);
  const toastTimerRef = useRef(null);
  const specsSaveHandlerRef = useRef(null);
  const pendingLeaveActionRef = useRef(null);
  const skipNextPopGuardRef = useRef(false);
  const historyGuardActiveRef = useRef(false);
  const hoverPeekMode = primaryView === 'evaluation' && sideBySide;
  const sidebarCollapsed = hoverPeekMode ? !sidebarPeekOpen : false;

  const showToast = useCallback((type, message) => {
    setToast({ open: true, type, message });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(prev => ({ ...prev, open: false }));
    }, 2600);
  }, []);

  const handleSpecAutoSaveStatus = useCallback((status) => {
    setSpecAutoSaveStatus(status || 'idle');
  }, []);

  const toggleSideBySide = () => {
    setSideBySide(prev => !prev);
  };

  const openSpecificationsView = () => {
    setPrimaryView('specifications');
  };

  const requestSpecLeave = useCallback((action, reason = 'leave this view') => {
    if (!specHasUnsavedChanges) {
      action?.();
      return;
    }
    pendingLeaveActionRef.current = action;
    setLeaveReason(reason);
    setLeaveConfirmOpen(true);
  }, [specHasUnsavedChanges]);

  const closeLeaveConfirm = useCallback(() => {
    setLeaveConfirmOpen(false);
    pendingLeaveActionRef.current = null;
  }, []);

  const proceedAfterLeaveChoice = useCallback(() => {
    const action = pendingLeaveActionRef.current;
    closeLeaveConfirm();
    action?.();
  }, [closeLeaveConfirm]);

  const handleSaveAndContinue = useCallback(async () => {
    const saveHandler = specsSaveHandlerRef.current;
    if (!saveHandler) {
      showToast('error', 'Save handler is not available. Please try again.');
      return;
    }
    const saved = await saveHandler();
    if (!saved) {
      showToast('error', 'Could not save changes. Please resolve and try again.');
      return;
    }
    setSpecHasUnsavedChanges(false);
    proceedAfterLeaveChoice();
  }, [showToast, proceedAfterLeaveChoice]);

  const handleDiscardAndContinue = useCallback(() => {
    setSpecHasUnsavedChanges(false);
    proceedAfterLeaveChoice();
  }, [proceedAfterLeaveChoice]);

  const openEvaluationView = async () => {
    requestSpecLeave(() => {
      // Evaluation tab should show sidebar by default; user can still hide it using Side-by-Side.
      setPrimaryView('evaluation');
      setSideBySide(false);
    }, 'switching to Evaluation View');
  };

  const handlePairSelection = async (groupId) => {
    if (groupId === selectedGroupId) return;
    if (primaryView === 'specifications') {
      requestSpecLeave(() => setSelectedGroupId(groupId), 'switching active pair');
      return;
    }
    setSelectedGroupId(groupId);
  };

  const handleBackWithGuard = async () => {
    requestSpecLeave(() => onBack?.(), 'going back to Modules');
  };

  const registerSpecsSaveHandler = useCallback((handler) => {
    specsSaveHandlerRef.current = handler;
  }, []);

  const handlePanelSave = useCallback(async () => {
    const saveHandler = specsSaveHandlerRef.current;
    if (!saveHandler) {
      showToast('error', 'Save handler is not available.');
      return;
    }
    setSpecPanelSaving(true);
    try {
      const saved = await saveHandler();
      if (!saved) {
        showToast('error', 'Save failed. Please check and try again.');
        return;
      }
      showToast('success', 'Module specifications saved.');
    } finally {
      setSpecPanelSaving(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!specHasUnsavedChanges) return undefined;

    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [specHasUnsavedChanges]);

  useEffect(() => {
    if (!specHasUnsavedChanges) {
      historyGuardActiveRef.current = false;
      return undefined;
    }

    if (!historyGuardActiveRef.current) {
      window.history.pushState({ __specGuard: true }, '', window.location.href);
      historyGuardActiveRef.current = true;
    }

    const onPopState = () => {
      if (skipNextPopGuardRef.current) {
        skipNextPopGuardRef.current = false;
        return;
      }

      requestSpecLeave(() => {
        skipNextPopGuardRef.current = true;
        window.history.back();
      }, 'using browser back/forward navigation');

      // Keep the current route active until user confirms save/discard.
      window.history.pushState({ __specGuard: true }, '', window.location.href);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [specHasUnsavedChanges, requestSpecLeave]);

  const triggerSpecsZipUpload = () => {
    if (!canEditSpecifications) return;
    specsUploadInputRef.current?.click();
  };

  const handleSpecsZipUpload = async (event) => {
    if (!canEditSpecifications) return;
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      showToast('error', 'Only .zip files are allowed for Module Specs upload.');
      event.target.value = '';
      return;
    }

    setZipUploadStatus('preparing');
    setZipUploadProgress(0);
    setZipUploadFileName(file.name);

    try {
      setZipUploadStatus('uploading');
      setZipUploadProgress(1);

      const saved = await uploadModuleSpecsZip(moduleId, file, {
        onUploadProgress: (progressEvent) => {
          const total = Number(progressEvent?.total || 0);
          const loaded = Number(progressEvent?.loaded || 0);
          if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(loaded)) return;
          const pct = Math.max(1, Math.min(99, Math.round((loaded / total) * 100)));
          setZipUploadProgress(pct);
        },
      });

      setModuleData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          spec_layout: saved.layout && typeof saved.layout === 'object' && !Array.isArray(saved.layout)
            ? saved.layout
            : prev.spec_layout || {},
        };
      });
      setZipUploadProgress(100);
      setZipUploadStatus('done');
      window.setTimeout(() => {
        setZipUploadStatus('idle');
        setZipUploadProgress(0);
      }, 900);

      // Refresh from server to ensure the zip was persisted in backend state.
      await loadData({ silent: true });
      const savedName = saved?.layout?.moduleSpecsZip?.name || file.name;
      showToast('success', `Module Specs zip uploaded: ${savedName}`);
    } catch {
      setZipUploadStatus('idle');
      setZipUploadProgress(0);
      showToast('error', 'Failed to upload Module Specs zip.');
    } finally {
      event.target.value = '';
    }
  };

  const handleSpecsZipDownload = async () => {
    try {
      let zip = moduleData?.spec_layout?.moduleSpecsZip;

      // Fetch full specifications payload (contains zip dataUrl) on demand.
      if (!zip?.dataUrl || !zip?.name) {
        try {
          const freshSpecs = await fetchModuleSpecifications(moduleId);
          zip = freshSpecs?.layout?.moduleSpecsZip;
          if (zip?.dataUrl && zip?.name) {
            setModuleData(prev => prev ? { ...prev, spec_layout: freshSpecs.layout || {} } : prev);
          }
        } catch {
          // Fall through to user-facing error below.
        }
      }

      if (!zip?.dataUrl || !zip?.name) {
        showToast('error', 'No Module Specs zip found. Upload one first.');
        return;
      }

      const link = document.createElement('a');
      link.href = zip.dataUrl;
      link.download = zip.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('success', `Downloaded: ${zip.name}`);
    } catch {
      showToast('error', 'Failed to download Module Specs zip.');
    }
  };

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
      showToast('error', 'Failed to save: ' + (err.message || 'Unknown error'));
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
      showToast('error', err.message || 'Failed to update roll numbers.');
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
      showToast('error', err.message || 'Failed to add pair.');
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
      showToast('error', err.message || 'Failed to update pair.');
    }
  };

  const confirmDeleteGroup = (groupId) => { setGroupToDelete(groupId); setDeleteConfirmOpen(true); };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    try {
      await deleteGroup(moduleId, groupToDelete);
      if (selectedGroupId === groupToDelete) setSelectedGroupId(null);
    } catch (err) {
      showToast('error', err.message || 'Failed to delete pair.');
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
      showToast('error', err.message || 'Failed to duplicate pair.');
    }
  };

  // ── Division handlers ────────────────────────────────────────────────────────

  const handleAddDivisionSubmit = async (formData) => {
    try {
      await createDivision(moduleId, { name: formData.name });
      setAddDivisionModalOpen(false);
      await loadData({ silent: true });
      showToast('success', 'Division created successfully.');
    } catch (err) {
      const apiError = String(err?.response?.data?.error || err?.message || '').toLowerCase();
      if (apiError.includes('already') || apiError.includes('exists') || apiError.includes('duplicate')) {
        showToast('error', 'Division name already exists. Please use a different name.');
      } else {
        showToast('error', err?.response?.data?.error || err?.message || 'Failed to create division.');
      }
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
      showToast('error', err.message || 'Failed to rename division.');
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
      showToast('error', err.message || 'Failed to delete division.');
    } finally {
      setDeleteDivisionConfirmOpen(false);
      setDivisionToDelete(null);
      await loadData({ silent: true });
    }
  };

  const handlePairDragStart = (groupId) => {
    setDraggedGroupId(groupId);
  };

  const handlePairDragEnd = () => {
    setDraggedGroupId(null);
    setDragOverZone(null);
  };

  const handleDropGroupToDivision = async (targetDivisionId) => {
    if (!draggedGroupId) return;

    const nextDivisionId = targetDivisionId || null;
    const movingGroup = (moduleData?.groups || []).find(g => g.id === draggedGroupId);

    if (!movingGroup || (movingGroup.division_id || null) === nextDivisionId) {
      handlePairDragEnd();
      return;
    }

    setModuleData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        groups: (prev.groups || []).map(g =>
          g.id === draggedGroupId ? { ...g, division_id: nextDivisionId } : g
        ),
      };
    });

    try {
      await updateGroup(moduleId, draggedGroupId, { division_id: nextDivisionId });
    } catch (err) {
      await loadData({ silent: true });
      showToast('error', err.message || 'Failed to move pair to selected division.');
    } finally {
      handlePairDragEnd();
    }
  };

  // ── Derived data ─────────────────────────────────────────────────────────────

  const divisions = useMemo(() => {
    const rawDivisions = Array.isArray(moduleData?.divisions) ? [...moduleData.divisions] : [];
    return rawDivisions.sort((a, b) => byNaturalLabel(a?.name, b?.name));
  }, [moduleData]);

  const divisionOptions = useMemo(() =>
    [{ label: 'No Division (ungrouped)', value: '' },
    ...divisions.map(d => ({ label: d.name, value: d.id }))],
  [divisions]);

  const ungroupedPairs = useMemo(() =>
    (moduleData?.groups || [])
      .filter(g => !g.division_id)
      .sort((a, b) => byNaturalLabel(a?.pair_id, b?.pair_id)),
  [moduleData]);

  const pairsByDivision = useMemo(() => {
    const map = {};
    for (const d of divisions) {
      map[d.id] = (moduleData?.groups || [])
        .filter(g => g.division_id === d.id)
        .sort((a, b) => byNaturalLabel(a?.pair_id, b?.pair_id));
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
  const canMovePairs = isAdmin;

  const selectedPairSpecifications = useMemo(() => {
    const raw = selectedGroup?.evaluation?.module_specifications;
    return {
      useCases: Array.isArray(raw?.useCases) ? raw.useCases : [],
      workflows: Array.isArray(raw?.workflows) ? raw.workflows : [],
      businessRules: Array.isArray(raw?.businessRules) ? raw.businessRules : [],
      layout: raw?.layout && typeof raw.layout === 'object' && !Array.isArray(raw.layout)
        ? raw.layout
        : {},
    };
  }, [selectedGroup]);

  const specsZipMetaText = useMemo(() => {
    const zip = moduleData?.spec_layout?.moduleSpecsZip;
    if (!zip?.name) return 'No Module Specs zip uploaded yet.';

    const uploadedAt = zip.uploadedAt ? new Date(zip.uploadedAt) : null;
    const when = uploadedAt && !Number.isNaN(uploadedAt.getTime())
      ? uploadedAt.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      : 'unknown time';

    return `Stored zip: ${zip.name} (${when})`;
  }, [moduleData?.spec_layout?.moduleSpecsZip]);

  const activePairMetaText = useMemo(() => {
    if (!selectedGroup) return 'No active pair selected';
    const divisionName = selectedGroup.division_id
      ? (divisions.find(d => d.id === selectedGroup.division_id)?.name || 'Division')
      : 'Ungrouped';
    return `Active Pair: ${divisionName} / ${selectedGroup.pair_id}`;
  }, [selectedGroup, divisions]);

  const savePairSpecifications = useCallback(async (_targetId, payload) => {
    if (!selectedGroupId) {
      throw new Error('Select a pair to save module specifications');
    }

    const clean = {
      useCases: Array.isArray(payload?.useCases) ? payload.useCases : [],
      workflows: Array.isArray(payload?.workflows) ? payload.workflows : [],
      businessRules: Array.isArray(payload?.businessRules) ? payload.businessRules : [],
      layout: payload?.layout && typeof payload.layout === 'object' && !Array.isArray(payload.layout)
        ? payload.layout
        : {},
    };

    const result = await updateEvaluation(moduleId, selectedGroupId, {
      module_specifications: clean,
    });

    const savedSpec = result?.evaluation?.module_specifications || clean;
    return {
      useCases: Array.isArray(savedSpec?.useCases) ? savedSpec.useCases : [],
      workflows: Array.isArray(savedSpec?.workflows) ? savedSpec.workflows : [],
      businessRules: Array.isArray(savedSpec?.businessRules) ? savedSpec.businessRules : [],
      layout: savedSpec?.layout && typeof savedSpec.layout === 'object' && !Array.isArray(savedSpec.layout)
        ? savedSpec.layout
        : {},
    };
  }, [moduleId, selectedGroupId]);

  const handleSpecificationsSaved = useCallback((saved) => {
    if (!selectedGroupId) return;

    const normalized = {
      useCases: Array.isArray(saved?.useCases) ? saved.useCases : [],
      workflows: Array.isArray(saved?.workflows) ? saved.workflows : [],
      businessRules: Array.isArray(saved?.businessRules) ? saved.businessRules : [],
      layout: saved?.layout && typeof saved.layout === 'object' && !Array.isArray(saved.layout)
        ? saved.layout
        : {},
    };

    setModuleData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        groups: Array.isArray(prev.groups)
          ? prev.groups.map(group => {
            if (group.id !== selectedGroupId) return group;
            return {
              ...group,
              evaluation: {
                ...(group.evaluation && typeof group.evaluation === 'object' ? group.evaluation : {}),
                module_specifications: normalized,
              },
            };
          })
          : prev.groups,
      };
    });
  }, [selectedGroupId]);

  // ── Render guards ─────────────────────────────────────────────────────────────

  if (loading && !moduleData) return <div className="p-8 flex justify-center text-gray-500">Loading Module Details...</div>;
  if (!moduleData) return <div className="p-8 flex justify-center text-red-500">Module not found.</div>;
  if (!Array.isArray(moduleData.groups)) return <div className="p-8 flex justify-center text-red-500">Invalid module data.</div>;

  const hasDivisions = divisions.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {toast.open && (
        <div className="fixed top-20 inset-x-0 z-[80] flex justify-center pointer-events-none px-4">
          <div className={`pointer-events-auto w-full max-w-md px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-sm text-sm font-medium flex items-start gap-2 ${toast.type === 'success' ? 'bg-emerald-50/95 text-emerald-700 border-emerald-200' : toast.type === 'error' ? 'bg-red-50/95 text-red-700 border-red-200' : 'bg-blue-50/95 text-blue-700 border-blue-200'}`}>
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            ) : toast.type === 'error' ? (
              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {onBack && (
              <button onClick={() => { void handleBackWithGuard(); }} className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 mb-1 transition-colors cursor-pointer">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Modules
              </button>
            )}
            <h1 className="text-2xl font-bold text-gray-900">{moduleData.name}</h1>
            <p className="text-xs text-gray-500 mt-0.5">Domain Lead Evaluation Dashboard</p>
          </div>

          <div className="ml-auto flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {primaryView === 'evaluation' && (
                <div className="flex items-center gap-2 mr-1">
                  <span className="text-xs text-gray-500">Side-by-Side</span>
                  <button
                    onClick={toggleSideBySide}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${sideBySide ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    {sideBySide ? 'On' : 'Off'}
                  </button>
                </div>
              )}

              {canEditSpecifications && (
                <>
                  <button
                    onClick={triggerSpecsZipUpload}
                    disabled={zipUploadStatus === 'preparing' || zipUploadStatus === 'uploading'}
                    className={`bg-white border border-gray-300 px-3 py-2 rounded-lg flex items-center text-sm font-medium transition-colors shadow-sm ${(zipUploadStatus === 'preparing' || zipUploadStatus === 'uploading') ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50 cursor-pointer'}`}
                  >
                    {(zipUploadStatus === 'preparing' || zipUploadStatus === 'uploading') ? (
                      <span className="inline-flex items-center">
                        <span className="w-4 h-4 mr-1.5 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
                        {zipUploadStatus === 'preparing' ? 'Preparing…' : 'Uploading…'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center"><Upload className="w-4 h-4 mr-1.5" /> Module Specs</span>
                    )}
                  </button>
                  <input
                    ref={specsUploadInputRef}
                    type="file"
                    accept=".zip,application/zip"
                    className="hidden"
                    onChange={handleSpecsZipUpload}
                  />
                </>
              )}
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

            <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-slate-100 p-1.5 shadow-inner">
              <button
                onClick={handleSpecsZipDownload}
                className="px-3 py-2 rounded-xl text-sm font-semibold transition-all text-slate-600 hover:text-slate-800 hover:bg-white/70"
              >
                <span className="inline-flex items-center"><Download className="w-4 h-4 mr-1.5" /> Module Specs</span>
              </button>
              <button
                onClick={openSpecificationsView}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${primaryView === 'specifications' ? 'bg-white text-indigo-700 border border-indigo-200 shadow-sm' : 'text-slate-600 hover:text-slate-800 hover:bg-white/70'}`}
              >
                Module Specifications
              </button>
              <button
                onClick={openEvaluationView}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${primaryView === 'evaluation' ? 'bg-white text-indigo-700 border border-indigo-200 shadow-sm' : 'text-slate-600 hover:text-slate-800 hover:bg-white/70'}`}
              >
                Evaluation View
              </button>
            </div>

            {(zipUploadStatus === 'preparing' || zipUploadStatus === 'uploading') && (
              <div className="flex items-center gap-2 self-end">
                {zipUploadStatus === 'uploading' ? (
                  <div
                    className="relative w-8 h-8 rounded-full"
                    style={{ background: `conic-gradient(#4f46e5 ${zipUploadProgress}%, #e5e7eb ${zipUploadProgress}% 100%)` }}
                  >
                    <div className="absolute inset-[4px] rounded-full bg-white flex items-center justify-center text-[10px] font-semibold text-indigo-700">
                      {zipUploadProgress}%
                    </div>
                  </div>
                ) : (
                  <span className="w-8 h-8 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
                )}
                <p className="text-xs text-gray-600 max-w-[360px] truncate" title={zipUploadFileName || ''}>
                  {zipUploadStatus === 'preparing'
                    ? `Preparing ${zipUploadFileName || 'zip file'}…`
                    : `Uploading ${zipUploadFileName || 'zip file'}… ${zipUploadProgress}%`}
                </p>
              </div>
            )}

            <div className="flex flex-wrap justify-end items-center gap-2">
              <span className="text-[11px] px-2 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 max-w-[360px] truncate" title={activePairMetaText}>
                {activePairMetaText}
              </span>
              <p className="text-xs text-gray-500 max-w-[520px] text-right truncate" title={specsZipMetaText}>
                {specsZipMetaText}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative flex flex-1 overflow-hidden">

        {hoverPeekMode && sidebarCollapsed && (
          <div
            className="absolute left-0 top-0 h-full w-2 z-20 cursor-ew-resize"
            onMouseEnter={() => setSidebarPeekOpen(true)}
            title="Hover to view pairs"
          />
        )}

        {/* Sidebar */}
        <div
          className={`${sidebarCollapsed ? 'w-0 border-r-0' : 'w-80 border-r border-gray-200'} bg-white flex flex-col shrink-0 overflow-hidden transition-all duration-300`}
          onMouseLeave={() => {
            if (hoverPeekMode) {
              setSidebarPeekOpen(false);
            }
          }}
        >
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
                  onSelectGroup={(groupId) => { void handlePairSelection(groupId); }}
                  onAddPair={openAddPairModal}
                  onRename={openRenameDivision}
                  onDelete={confirmDeleteDivision}
                  canMovePairs={canMovePairs}
                  isDropActive={dragOverZone === `division:${div.id}`}
                  onDragEnterZone={(divisionId) => setDragOverZone(`division:${divisionId}`)}
                  onDropGroup={handleDropGroupToDivision}
                  onPairDragStart={handlePairDragStart}
                  onPairDragEnd={handlePairDragEnd}
                />
              );
            })}

            {/* Ungrouped pairs */}
            {(hasDivisions || visibleUngrouped.length > 0) && (
              <div
                className={`rounded-lg ${dragOverZone === 'ungrouped' ? 'ring-2 ring-indigo-200 bg-indigo-50/30' : ''}`}
                onDragEnter={canMovePairs ? () => setDragOverZone('ungrouped') : undefined}
                onDragOver={canMovePairs ? (e) => { e.preventDefault(); } : undefined}
                onDrop={canMovePairs ? (e) => { e.preventDefault(); handleDropGroupToDivision(null); } : undefined}
              >
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
                      onClick={() => { void handlePairSelection(group.id); }}
                      draggable={canMovePairs}
                      onDragStart={() => handlePairDragStart(group.id)}
                      onDragEnd={handlePairDragEnd}
                    />
                  ))}
                  {visibleUngrouped.length === 0 && (
                    <p className="text-xs text-gray-400 italic pl-3 py-2">Drop pairs here to ungroup them.</p>
                  )}
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
        <div className={`flex-1 bg-gray-50 p-6 relative min-h-0 ${primaryView === 'evaluation' && !sideBySide ? 'overflow-y-auto' : 'overflow-hidden'}`}>

          {primaryView === 'specifications' ? (
            <div className="w-full h-full min-h-0">
              {selectedGroup ? (
                <div className="w-full h-full min-h-0">
                  <ModuleSpecifications
                    key={`pair-spec-${selectedGroup.id}`}
                    moduleId={selectedGroup.id}
                    isAdmin={canEditSpecifications}
                    initialData={selectedPairSpecifications}
                    onSaved={handleSpecificationsSaved}
                    onAutoSaveStatusChange={handleSpecAutoSaveStatus}
                    onDirtyStateChange={setSpecHasUnsavedChanges}
                    onRegisterSaveHandler={registerSpecsSaveHandler}
                    autoSave={false}
                    saveSpecifications={savePairSpecifications}
                    storageKeyPrefix={`pair-module-spec-${selectedGroup.id}`}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">
                  Select a pair from the sidebar to view its module specifications.
                </div>
              )}
            </div>
          ) : (
            <>
              <div className={`transition-all duration-300 ${sideBySide && !sidebarPeekOpen ? 'h-full overflow-y-auto pr-[35%]' : 'h-full overflow-y-auto'}`}>
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

              <aside
                className={`absolute top-0 right-0 h-full w-[35%] bg-gray-50 border-l border-gray-200 transition-transform duration-300 ${sideBySide && !sidebarPeekOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`}
              >
                <div className="h-full p-4">
                  <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-800">Module Specifications (Editable)</h3>
                      <div className="flex items-center gap-2">
                        {canEditSpecifications && (
                          <button
                            onClick={() => { void handlePanelSave(); }}
                            disabled={specPanelSaving}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shadow-sm ${specPanelSaving ? 'bg-amber-50 text-amber-700 border-amber-200 cursor-wait' : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 cursor-pointer'}`}
                          >
                            <Save className="w-3.5 h-3.5" />
                            {specPanelSaving ? 'Saving...' : 'Save'}
                          </button>
                        )}
                        <button
                          onClick={() => setSideBySide(false)}
                          className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                        >
                          Collapse
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      {selectedGroup ? (
                        <ModuleSpecifications
                          key={`pair-spec-drawer-${selectedGroup.id}`}
                          moduleId={selectedGroup.id}
                          isAdmin={canEditSpecifications}
                          initialData={selectedPairSpecifications}
                          onSaved={handleSpecificationsSaved}
                          onAutoSaveStatusChange={handleSpecAutoSaveStatus}
                          onDirtyStateChange={setSpecHasUnsavedChanges}
                          onRegisterSaveHandler={registerSpecsSaveHandler}
                          autoSave={false}
                          saveSpecifications={savePairSpecifications}
                          storageKeyPrefix={`pair-module-spec-${selectedGroup.id}`}
                          drawerMode
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center text-sm text-gray-500 px-4 text-center">
                          Select a pair to edit module specifications.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </aside>
            </>
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

      {leaveConfirmOpen && (
        <div className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Save changes before leaving?</h3>
              <p className="text-sm text-slate-600 mt-1">
                You have unsaved Module Specifications changes while {leaveReason}.
              </p>
            </div>
            <div className="px-5 py-4 flex items-center justify-end gap-2 bg-slate-50">
              <button
                onClick={handleDiscardAndContinue}
                className="px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 bg-white hover:bg-slate-100"
              >
                Discard
              </button>
              <button
                onClick={() => { void handleSaveAndContinue(); }}
                className="px-3.5 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Save and Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
