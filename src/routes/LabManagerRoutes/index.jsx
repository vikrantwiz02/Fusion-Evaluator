import React from 'react';
import AdminDashboard from '../../Modules/LabManager/AdminDashboard';
import LeadTeamsDashboard from '../../Modules/LabManager/LeadTeamsDashboard';
import LeadDashboard from '../../Modules/LabManager/LeadDashboard';
import LeadModulesList from '../../Modules/LabManager/LeadModulesList';
import { LogOut, User } from 'lucide-react';
import { NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';

function ModuleDashboardRoute({ user, onBack }) {
  const { moduleId } = useParams();
  return <LeadDashboard moduleId={moduleId} user={user} onBack={onBack} />;
}

function TeamsModuleDashboardRoute({ user, onBack }) {
  const { moduleId } = useParams();
  return <LeadTeamsDashboard moduleId={moduleId} user={user} onBack={onBack} />;
}

export default function LabManagerRoutes({ user, onLogout }) {
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';
  const canAccessLeadView = isAdmin || user?.canAccessLeadView !== false;
  const canAccessTeamsView = isAdmin || user?.canAccessTeamsView === true || user?.role === 'team';
  const isTeamOnlyUser = user?.role === 'team';
  const modulesRoot = isAdmin ? '/admin/modules' : isTeamOnlyUser ? '/lead/teams-modules' : '/lead/modules';
  const teamsModulesRoot = isAdmin ? '/admin/teams-modules' : '/lead/teams-modules';

  const handleSelectModule = (moduleId, rootPath = modulesRoot) => {
    navigate(`${rootPath}/${moduleId}`);
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
          <div className="hidden sm:flex items-center rounded-lg border border-gray-700 bg-gray-800/80 p-1">
            {canAccessLeadView && (
              <NavLink
                to={modulesRoot}
                className={({ isActive }) => `px-2.5 py-1 text-xs rounded-md transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'} ${isTeamOnlyUser ? 'hidden' : ''}`}
              >
                Domain Lead
              </NavLink>
            )}
            {canAccessTeamsView && (
              <NavLink
                to={teamsModulesRoot}
                className={({ isActive }) => `px-2.5 py-1 text-xs rounded-md transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'}`}
              >
                Teams View
              </NavLink>
            )}
          </div>
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
            path="/admin/teams-modules"
            element={
              isAdmin
                ? <LeadModulesList modules={[]} onSelectModule={(moduleId) => handleSelectModule(moduleId, teamsModulesRoot)} viewType="teams" />
                : <Navigate to={modulesRoot} replace />
            }
          />
          <Route
            path="/admin/teams-modules/:moduleId"
            element={
              isAdmin
                ? <TeamsModuleDashboardRoute user={user} onBack={() => navigate(teamsModulesRoot)} />
                : <Navigate to={modulesRoot} replace />
            }
          />

          <Route
            path="/lead/modules"
            element={
              isAdmin || isTeamOnlyUser || !canAccessLeadView
                ? <Navigate to={modulesRoot} replace />
                : <LeadModulesList modules={user.assignedLeadModules || user.assignedModules} onSelectModule={handleSelectModule} viewType="lead" />
            }
          />
          <Route
            path="/lead/modules/:moduleId"
            element={
              isAdmin || isTeamOnlyUser
                ? <Navigate to={modulesRoot} replace />
                : <ModuleDashboardRoute user={user} onBack={handleBackToModules} />
            }
          />

          <Route
            path="/lead/teams-modules"
            element={
              isAdmin || !canAccessTeamsView
                ? <Navigate to={modulesRoot} replace />
                : <LeadModulesList modules={user.assignedTeamModules || []} onSelectModule={(moduleId) => handleSelectModule(moduleId, teamsModulesRoot)} viewType="teams" />
            }
          />
          <Route
            path="/lead/teams-modules/:moduleId"
            element={
              isAdmin
                ? <Navigate to={modulesRoot} replace />
                : <TeamsModuleDashboardRoute user={user} onBack={() => navigate(teamsModulesRoot)} />
            }
          />

          <Route path="*" element={<Navigate to={modulesRoot} replace />} />
        </Routes>
      </div>
    </div>
  );
}
