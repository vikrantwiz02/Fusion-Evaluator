import React, { useState } from 'react';
import AdminDashboard from '../../Modules/LabManager/AdminDashboard';
import LeadDashboard from '../../Modules/LabManager/LeadDashboard';
import LeadModulesList from '../../Modules/LabManager/LeadModulesList';
import { LogOut, User } from 'lucide-react';

export default function LabManagerRoutes({ user, onLogout }) {
  const [selectedModuleId, setSelectedModuleId] = useState(null);

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <nav className="bg-gray-900 text-white px-6 py-3 flex justify-between items-center shadow-md z-10">
        <div className="flex items-center space-x-2">
          <span className="font-semibold tracking-wide">Fusion Evaluator</span>
          <span className="bg-gray-800 text-xs px-2 py-1 rounded text-gray-300 uppercase tracking-wider ml-4">
            {user.role}
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center text-sm text-gray-300">
            <User className="w-4 h-4 mr-1" />
            {user.email}
          </div>
          <button onClick={onLogout} className="flex items-center text-sm text-red-400 hover:text-red-300 transition-colors cursor-pointer">
            <LogOut className="w-4 h-4 mr-1" /> Logout
          </button>
        </div>
      </nav>

      <div className="flex-1 overflow-auto">
        {user.role === 'admin' ? (
          selectedModuleId ? (
            <LeadDashboard moduleId={selectedModuleId} user={user} onBack={() => setSelectedModuleId(null)} />
          ) : (
            <AdminDashboard onSelectModule={setSelectedModuleId} />
          )
        ) : (
          selectedModuleId ? (
            <LeadDashboard moduleId={selectedModuleId} user={user} onBack={() => setSelectedModuleId(null)} />
          ) : (
            <LeadModulesList modules={user.assignedModules} onSelectModule={setSelectedModuleId} />
          )
        )}
      </div>
    </div>
  );
}
