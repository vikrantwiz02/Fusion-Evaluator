import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, Upload, User, XCircle } from 'lucide-react';
import ModuleSpecifications from './components/ModuleSpecifications';
import {
  fetchAllModules,
  fetchTeamsModuleSpecifications,
  saveTeamsModuleSpecifications,
  uploadTeamsModuleSpecsZip,
} from './api';

export default function LeadTeamsDashboard({ moduleId, user, onBack }) {
  const isAdmin = user?.role === 'admin';
  const canEditSpecifications = isAdmin || user?.role === 'lead' || user?.role === 'team';
  const [moduleData, setModuleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [specAutoSaveStatus, setSpecAutoSaveStatus] = useState('idle');
  const [zipUploadStatus, setZipUploadStatus] = useState('idle');
  const [zipUploadProgress, setZipUploadProgress] = useState(0);
  const [zipUploadFileName, setZipUploadFileName] = useState('');
  const [toast, setToast] = useState({ open: false, type: 'info', message: '' });
  const specsUploadInputRef = useRef(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((type, message) => {
    setToast({ open: true, type, message });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(prev => ({ ...prev, open: false }));
    }, 2600);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allModules, teamsSpecs] = await Promise.all([
        fetchAllModules('teams'),
        fetchTeamsModuleSpecifications(moduleId),
      ]);

      const moduleMeta = (Array.isArray(allModules) ? allModules : []).find(mod => mod?.id === moduleId) || {};

      setModuleData({
        ...moduleMeta,
        team_spec_use_cases: teamsSpecs.useCases,
        team_spec_workflows: teamsSpecs.workflows,
        team_spec_rules: teamsSpecs.businessRules,
        team_spec_layout: teamsSpecs.layout,
      });
    } catch {
      setModuleData(null);
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => () => {
    window.clearTimeout(toastTimerRef.current);
  }, []);

  const handleSpecAutoSaveStatus = useCallback((status) => {
    setSpecAutoSaveStatus(status || 'idle');
  }, []);

  const moduleSpecificationsData = useMemo(() => ({
    useCases: Array.isArray(moduleData?.team_spec_use_cases) ? moduleData.team_spec_use_cases : [],
    workflows: Array.isArray(moduleData?.team_spec_workflows) ? moduleData.team_spec_workflows : [],
    businessRules: Array.isArray(moduleData?.team_spec_rules) ? moduleData.team_spec_rules : [],
    layout: moduleData?.team_spec_layout && typeof moduleData.team_spec_layout === 'object' && !Array.isArray(moduleData.team_spec_layout)
      ? moduleData.team_spec_layout
      : {},
  }), [moduleData]);

  const specsZipMetaText = useMemo(() => {
    const zip = moduleData?.team_spec_layout?.moduleSpecsZip;
    if (!zip?.name || !zip?.dataUrl) return 'No Module Specs zip uploaded yet.';

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
  }, [moduleData?.team_spec_layout?.moduleSpecsZip]);

  const handleSpecificationsSaved = useCallback((saved) => {
    setModuleData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        team_spec_use_cases: saved.useCases,
        team_spec_workflows: saved.workflows,
        team_spec_rules: saved.businessRules,
        team_spec_layout: saved.layout && typeof saved.layout === 'object' && !Array.isArray(saved.layout)
          ? saved.layout
          : {},
      };
    });
  }, []);

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

      const saved = await uploadTeamsModuleSpecsZip(moduleId, file, {
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
          team_spec_layout: saved.layout && typeof saved.layout === 'object' && !Array.isArray(saved.layout)
            ? saved.layout
            : prev.team_spec_layout || {},
        };
      });
      setZipUploadProgress(100);
      setZipUploadStatus('done');
      window.setTimeout(() => {
        setZipUploadStatus('idle');
        setZipUploadProgress(0);
      }, 900);
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
      let zip = moduleData?.team_spec_layout?.moduleSpecsZip;
      if (!zip?.dataUrl || !zip?.name) {
        const fresh = await fetchTeamsModuleSpecifications(moduleId);
        zip = fresh?.layout?.moduleSpecsZip;
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

  if (loading && !moduleData) return <div className="p-8 flex justify-center text-gray-500">Loading Module Details...</div>;
  if (!moduleData) return <div className="p-8 flex justify-center text-red-500">Module not found.</div>;

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {toast.open && (
        <div className="fixed top-20 inset-x-0 z-[80] flex justify-center pointer-events-none px-4">
          <div className={`pointer-events-auto w-full max-w-md px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-sm text-sm font-medium flex items-start gap-2 ${toast.type === 'success' ? 'bg-emerald-50/95 text-emerald-700 border-emerald-200' : toast.type === 'error' ? 'bg-red-50/95 text-red-700 border-red-200' : 'bg-blue-50/95 text-blue-700 border-blue-200'}`}>
            {toast.type === 'error' ? <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {onBack && (
              <button onClick={onBack} className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 mb-1 transition-colors cursor-pointer">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Modules
              </button>
            )}
            <h1 className="text-2xl font-bold text-gray-900">{moduleData.name}</h1>
            <p className="text-xs text-gray-500 mt-0.5">Domain Lead Teams Dashboard</p>
          </div>

          <div className="ml-auto flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
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
              <button
                onClick={handleSpecsZipDownload}
                className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center text-sm font-medium cursor-pointer transition-colors shadow-sm"
              >
                <Download className="w-4 h-4 mr-1.5" /> Download Module Specs
              </button>
              <span className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-600">
                {specAutoSaveStatus === 'saving' ? 'Auto-saving...' : specAutoSaveStatus === 'saved' ? 'Auto-saved' : 'Auto-save on'}
              </span>
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

            <p className="text-xs text-gray-500 max-w-[520px] text-right truncate" title={specsZipMetaText}>
              {specsZipMetaText}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 bg-gray-50 p-6 relative min-h-0 overflow-hidden">
        <div className="w-full h-full min-h-0">
          <ModuleSpecifications
            moduleId={moduleId}
            isAdmin={canEditSpecifications}
            initialData={moduleSpecificationsData}
            onSaved={handleSpecificationsSaved}
            onAutoSaveStatusChange={handleSpecAutoSaveStatus}
            autoSave={canEditSpecifications}
            saveSpecifications={saveTeamsModuleSpecifications}
            storageKeyPrefix="teams-module-spec"
          />
        </div>
      </div>

      <footer className="shrink-0 border-t border-gray-200 bg-white px-6 py-3 text-xs text-gray-500 flex items-center justify-end gap-2">
        <User className="w-3.5 h-3.5" />
        Isolated teams data storage is active for this module.
      </footer>
    </div>
  );
}
