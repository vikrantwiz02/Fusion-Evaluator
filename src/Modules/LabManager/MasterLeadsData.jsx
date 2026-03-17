import React, { useState, useEffect, useMemo } from 'react';
import { fetchAllModules } from './api';
import { BookOpen, CheckCircle2, Shield, Users, Server, Layout, XCircle, Hash } from 'lucide-react';

function summarizeModule(mod) {
  const groups = Array.isArray(mod.groups) ? mod.groups : [];

  const summary = groups.reduce(
    (acc, group) => {
      const evalData = group.evaluation || {};

      const backendFiles = evalData.backend?.files || {};
      const frontendFiles = evalData.frontend?.files || {};

      acc.backendFilesTotal += Object.keys(backendFiles).length;
      acc.backendFilesDone += Object.values(backendFiles).filter(Boolean).length;

      acc.frontendFilesTotal += Object.keys(frontendFiles).length;
      acc.frontendFilesDone += Object.values(frontendFiles).filter(Boolean).length;

      acc.backendEndpoints += (evalData.backend?.endpoints || []).length;
      acc.backendFunctions += (evalData.backend?.functions || []).length;
      if (evalData.backend?.architecture_matches_reference) {
        acc.backendArchitectureMatches += 1;
      }

      acc.frontendComponents += (evalData.frontend?.components || []).length;
      acc.frontendEndpoints += (evalData.frontend?.endpoints_used || []).length;
      if (evalData.frontend?.architecture_matches_reference) {
        acc.frontendArchitectureMatches += 1;
      }

      const features = evalData.features || [];
      acc.featuresTotal += features.length;
      acc.featuresFunctional += features.filter(f => f.is_functional).length;

      if ((evalData.notes || '').trim()) {
        acc.notesPairs += 1;
      }

      const rollNumbers = Array.isArray(group.roll_numbers) ? group.roll_numbers : [];
      rollNumbers.forEach(r => acc.rollNumberSet.add(r));

      return acc;
    },
    {
      backendFilesDone: 0,
      backendFilesTotal: 0,
      backendEndpoints: 0,
      backendFunctions: 0,
      backendArchitectureMatches: 0,
      frontendFilesDone: 0,
      frontendFilesTotal: 0,
      frontendComponents: 0,
      frontendEndpoints: 0,
      frontendArchitectureMatches: 0,
      featuresFunctional: 0,
      featuresTotal: 0,
      notesPairs: 0,
      rollNumberSet: new Set(),
    }
  );

  return {
    ...summary,
    uniqueRollNumbers: summary.rollNumberSet.size,
  };
}

export default function MasterLeadsData({ onSelectModule }) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedModule, setExpandedModule] = useState(null);

  const sortedModules = useMemo(() => {
    return [...modules].sort((a, b) => {
      const aName = String(a?.name || '').toLowerCase();
      const bName = String(b?.name || '').toLowerCase();
      return aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [modules]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        let data = await fetchAllModules();
        // Ensure all modules are valid
        if (!Array.isArray(data)) {
          data = [];
        } else {
          data = data.filter(m => m && typeof m === 'object' && m.groups && Array.isArray(m.assigned_leads));
        }
        setModules(data);
      } catch (err) {
        setModules([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="p-8 flex justify-center text-gray-500">Loading Master Data...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50 px-6 py-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <Shield className="w-5 h-5 mr-2 text-indigo-600" />
          Master Evaluation Data (Module-Wise)
        </h2>
        <span className="text-sm text-gray-500 font-medium">{modules.length} Total Modules</span>
      </div>
      
      <div className="divide-y divide-gray-100">
        {sortedModules.map((mod, idx) => {
          if (!mod || !mod.groups || !mod.assigned_leads) {
            return null;
          }
          const totalPairs = mod.groups.length;
          const functionalPairs = mod.groups.filter(g => g.evaluation?.is_functional).length;
          const progress = totalPairs > 0 ? Math.round((functionalPairs / totalPairs) * 100) : 0;
          const isExpanded = expandedModule === mod.id;
          const moduleSummary = summarizeModule(mod);
          
          return (
            <div key={mod.id} className="transition-colors">
              <div 
                className={`px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 ${isExpanded ? 'bg-slate-50' : ''}`}
                onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center">
                    <BookOpen className="w-5 h-5 text-indigo-500 mr-3" />
                    <h3 className="font-semibold text-gray-900 text-lg">{mod.name}</h3>
                  </div>
                  <div className="mt-2 flex items-center text-sm text-gray-600 space-x-4">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-1.5 text-gray-400" />
                      {mod.assigned_leads.length > 0 ? mod.assigned_leads.join(', ') : 'Unassigned'}
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium mr-1.5 text-gray-700">{totalPairs}</span> Pairs
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6">
                  <div className="flex flex-col items-end">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium text-gray-700">{progress}%</span>
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{functionalPairs} of {totalPairs} pairs functional</span>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="px-6 py-4 bg-slate-50 border-t border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
                    {mod.has_backend !== false && (
                      <div className="bg-white border border-gray-200 rounded-xl p-3">
                        <div className="flex items-center text-xs text-gray-500 mb-1"><Server className="w-3.5 h-3.5 mr-1.5" />Backend Summary</div>
                        <div className="text-sm text-gray-700">Files: <span className="font-semibold">{moduleSummary.backendFilesDone}/{moduleSummary.backendFilesTotal}</span></div>
                        <div className="text-sm text-gray-700">Endpoints: <span className="font-semibold">{moduleSummary.backendEndpoints}</span></div>
                        <div className="text-sm text-gray-700">Functions: <span className="font-semibold">{moduleSummary.backendFunctions}</span></div>
                        <div className="text-sm text-gray-700">Architecture Match: <span className="font-semibold">{moduleSummary.backendArchitectureMatches}/{totalPairs}</span></div>
                      </div>
                    )}

                    {mod.has_frontend !== false && (
                      <div className="bg-white border border-gray-200 rounded-xl p-3">
                        <div className="flex items-center text-xs text-gray-500 mb-1"><Layout className="w-3.5 h-3.5 mr-1.5" />Frontend Summary</div>
                        <div className="text-sm text-gray-700">Files: <span className="font-semibold">{moduleSummary.frontendFilesDone}/{moduleSummary.frontendFilesTotal}</span></div>
                        <div className="text-sm text-gray-700">Components: <span className="font-semibold">{moduleSummary.frontendComponents}</span></div>
                        <div className="text-sm text-gray-700">Integrated Endpoints: <span className="font-semibold">{moduleSummary.frontendEndpoints}</span></div>
                        <div className="text-sm text-gray-700">Architecture Match: <span className="font-semibold">{moduleSummary.frontendArchitectureMatches}/{totalPairs}</span></div>
                      </div>
                    )}

                    <div className="bg-white border border-gray-200 rounded-xl p-3">
                      <div className="flex items-center text-xs text-gray-500 mb-1"><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Evaluation Summary</div>
                      <div className="text-sm text-gray-700">Functional Pairs: <span className="font-semibold">{functionalPairs}/{totalPairs}</span></div>
                      <div className="text-sm text-gray-700">Features: <span className="font-semibold">{moduleSummary.featuresFunctional}/{moduleSummary.featuresTotal}</span></div>
                      <div className="text-sm text-gray-700">Pairs with Notes: <span className="font-semibold">{moduleSummary.notesPairs}</span></div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-3">
                      <div className="flex items-center text-xs text-gray-500 mb-1"><Hash className="w-3.5 h-3.5 mr-1.5" />Class Summary</div>
                      <div className="text-sm text-gray-700">Assigned Leads: <span className="font-semibold">{mod.assigned_leads.length}</span></div>
                      <div className="text-sm text-gray-700">Total Pairs: <span className="font-semibold">{totalPairs}</span></div>
                      <div className="text-sm text-gray-700">Unique Roll Nos: <span className="font-semibold">{moduleSummary.uniqueRollNumbers}</span></div>
                    </div>
                  </div>

                  {mod.groups.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {mod.groups.map(group => {
                        const backendFiles = Object.values(group.evaluation?.backend?.files || {}).filter(Boolean).length;
                        const totalBackendFiles = Object.keys(group.evaluation?.backend?.files || {}).length;
                        const frontendFiles = Object.values(group.evaluation?.frontend?.files || {}).filter(Boolean).length;
                        const totalFrontendFiles = Object.keys(group.evaluation?.frontend?.files || {}).length;
                        const features = group.evaluation?.features || [];
                        const functionalFeatures = features.filter(f => f.is_functional).length;

                        return (
                          <div 
                            key={group.id} 
                            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
                            onClick={() => onSelectModule && onSelectModule(mod.id)}
                            title="Click to view full pair details"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className="font-bold text-gray-900">{group.pair_id}</h4>
                                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${group.category === 'AI' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {group.category}
                                </span>
                              </div>
                              {group.evaluation?.is_functional ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-400" />
                              )}
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              {mod.has_backend !== false && (
                                <div className="flex justify-between items-center text-gray-600">
                                  <span className="flex items-center"><Server className="w-3.5 h-3.5 mr-1.5"/> Backend Files</span>
                                  <span className="font-medium">{backendFiles}/{totalBackendFiles}</span>
                                </div>
                              )}
                              {mod.has_backend !== false && (
                                <div className="flex justify-between items-center text-gray-600">
                                  <span>Backend Architecture</span>
                                  <span className={`font-medium ${group.evaluation?.backend?.architecture_matches_reference ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {group.evaluation?.backend?.architecture_matches_reference ? 'Matching' : 'Not Matching'}
                                  </span>
                                </div>
                              )}
                              {mod.has_frontend !== false && (
                                <div className="flex justify-between items-center text-gray-600">
                                  <span className="flex items-center"><Layout className="w-3.5 h-3.5 mr-1.5"/> Frontend Files</span>
                                  <span className="font-medium">{frontendFiles}/{totalFrontendFiles}</span>
                                </div>
                              )}
                              {mod.has_frontend !== false && (
                                <div className="flex justify-between items-center text-gray-600">
                                  <span>Frontend Architecture</span>
                                  <span className={`font-medium ${group.evaluation?.frontend?.architecture_matches_reference ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {group.evaluation?.frontend?.architecture_matches_reference ? 'Matching' : 'Not Matching'}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between items-center text-gray-600">
                                <span className="flex items-center"><CheckCircle2 className="w-3.5 h-3.5 mr-1.5"/> Features</span>
                                <span className="font-medium">{functionalFeatures}/{features.length}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic py-2">No pairs have been added to this module yet.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {sortedModules.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500 italic">No modules found.</div>
        )}
      </div>
    </div>
  );
}
