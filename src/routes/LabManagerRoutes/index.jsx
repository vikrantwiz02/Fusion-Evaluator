import React from 'react';
import AdminDashboard from '../../Modules/LabManager/AdminDashboard';
import LeadDashboard from '../../Modules/LabManager/LeadDashboard';
import LeadModulesList from '../../Modules/LabManager/LeadModulesList';
import { LogOut, User } from 'lucide-react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';

function ModuleDashboardRoute({ user, onBack }) {
  const { moduleId } = useParams();
  return <LeadDashboard moduleId={moduleId} user={user} onBack={onBack} />;
}

export default function LabManagerRoutes({ user, onLogout }) {
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';
  const modulesRoot = isAdmin ? '/admin/modules' : '/lead/modules';

  const handleSelectModule = (moduleId) => {
    navigate(`${modulesRoot}/${moduleId}`);
  };

  const handleBackToModules = () => {
    navigate(modulesRoot);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <nav className="sticky top-0 bg-gray-900 text-white px-6 py-3 flex justify-between items-center shadow-md z-[100]">
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
        <Routes>
          <Route path="/" element={<Navigate to={modulesRoot} replace />} />

          <Route
            path="/admin/modules"
            element={
              isAdmin
                ? <AdminDashboard onSelectModule={handleSelectModule} currentView="modules" />
                : <Navigate to={modulesRoot} replace />
            }
          />
          <Route
            path="/admin/master-data"
            element={
              isAdmin
                ? <AdminDashboard onSelectModule={handleSelectModule} currentView="leads" />
                : <Navigate to={modulesRoot} replace />
            }
          />
          <Route
            path="/admin/modules/:moduleId"
            element={
              isAdmin
                ? <ModuleDashboardRoute user={user} onBack={handleBackToModules} />
                : <Navigate to={modulesRoot} replace />
            }
          />

          <Route
            path="/lead/modules"
            element={
              isAdmin
                ? <Navigate to={modulesRoot} replace />
                : <LeadModulesList modules={user.assignedModules} onSelectModule={handleSelectModule} />
            }
          />
          <Route
            path="/lead/modules/:moduleId"
            element={
              isAdmin
                ? <Navigate to={modulesRoot} replace />
                : <ModuleDashboardRoute user={user} onBack={handleBackToModules} />
            }
          />

          <Route path="*" element={<Navigate to={modulesRoot} replace />} />
        </Routes>
      </div>
    </div>
  );
}
