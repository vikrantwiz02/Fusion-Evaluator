import React, { useState, useEffect } from 'react';
import { fetchAllModules } from './api';
import { ChevronRight, Clock, Calendar } from 'lucide-react';

export default function LeadModulesList({ modules, onSelectModule }) {
  const [liveModules, setLiveModules] = useState(() => (Array.isArray(modules) ? modules : []));

  useEffect(() => {
    // Render immediately from login payload to avoid initial blank state.
    setLiveModules(Array.isArray(modules) ? modules : []);

    // Fetch fresh, server-authorized module list for this lead.
    fetchAllModules()
      .then(fresh => {
        setLiveModules(Array.isArray(fresh) ? fresh : []);
      })
      .catch(() => {
        // Keep already rendered data on refresh failures.
      });
  }, [modules]);

  const checkTimeAccess = (accessStart, accessEnd) => {
    if (accessStart == null && accessEnd == null) return true;
    const now = Date.now();
    if (accessStart != null && now < new Date(accessStart).getTime()) return false;
    if (accessEnd != null && now > new Date(accessEnd).getTime()) return false;
    return true;
  };

  const formatAccessWindow = (accessStart, accessEnd) => {
    if (!accessStart && !accessEnd) return 'Unrestricted';
    const fmt = iso => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '∞';
    return `${fmt(accessStart)} — ${fmt(accessEnd)}`;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">My Assigned Modules</h1>
      <p className="text-gray-500 mb-8">Select a module to begin evaluation.</p>
      
      <div className="space-y-4">
        {liveModules.map(mod => {
          const hasAccess = checkTimeAccess(mod.access_start, mod.access_end);
          
          return (
            <div 
              key={mod.id} 
              className={`bg-white rounded-2xl shadow-sm border ${hasAccess ? 'border-gray-200 hover:border-indigo-300 hover:shadow-md cursor-pointer' : 'border-red-100 opacity-75'} p-6 transition-all`} 
              onClick={() => hasAccess && onSelectModule(mod.id)}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold text-gray-900 truncate">{mod.name}</h2>
                    <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap">{mod.assignment_name || `Week ${mod.week_num}`}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6 text-sm text-gray-500">
                    <div className="flex items-center mb-1 sm:mb-0">
                      <Calendar className="w-4 h-4 mr-1.5" />
                      Date: {mod.date || 'Not set'}
                    </div>

                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1.5" />
                      Access Window: {formatAccessWindow(mod.access_start, mod.access_end)}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end lg:justify-start">
                  {!hasAccess ? (
                    <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg text-center font-medium whitespace-nowrap">
                      Outside allowed access window
                    </div>
                  ) : (
                    <span className="flex items-center text-indigo-600 text-sm font-medium whitespace-nowrap">
                      Enter Dashboard <ChevronRight className="w-4 h-4 ml-1" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {liveModules.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <p className="text-gray-500">You have not been assigned to any modules yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
