import React, { useEffect, useMemo, useState } from 'react';
import Login from '../../Modules/Auth/Login';
import LabManagerRoutes from '../LabManagerRoutes';
import { fetchAllModules } from '../../Modules/LabManager/api';
import { Navigate, Route, Routes } from 'react-router-dom';

/**
 * Client-side mirror of the server's isWithinAccessWindow utility.
 * Returns true when the current moment is within [accessStart, accessEnd].
 * Null values mean "no restriction" on that boundary.
 */
function isWithinAccessWindow(accessStart, accessEnd) {
  if (accessStart == null && accessEnd == null) return true;

  const now = Date.now();

  if (accessStart != null) {
    const start = new Date(accessStart).getTime();
    if (!isNaN(start) && now < start) return false;
  }

  if (accessEnd != null) {
    const end = new Date(accessEnd).getTime();
    if (!isNaN(end) && now > end) return false;
  }

  return true;
}

export default function GlobalRoutes() {
  const [user, setUser] = useState(() => {
    const storedUser = window.localStorage.getItem('lab-user');
    if (!storedUser) return null;

    try {
      return JSON.parse(storedUser);
    } catch {
      return null;
    }
  });

  const handleLogin = (nextUser) => {
    window.localStorage.setItem('lab-user', JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const handleLogout = () => {
    window.localStorage.removeItem('lab-user');
    setUser(null);
  };

  // Handle 401 responses from the API interceptor (expired / revoked JWT)
  useEffect(() => {
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const getAccessWindowForUserRole = (mod, role) => {
    if (role === 'team') {
      return {
        start: mod?.team_access_start ?? null,
        end: mod?.team_access_end ?? null,
      };
    }
    return {
      start: mod?.access_start ?? null,
      end: mod?.access_end ?? null,
    };
  };

  const shouldAutoLogout = useMemo(() => {
    if (!user || (user.role !== 'lead' && user.role !== 'team')) return false;

    const assigned = user.role === 'team'
      ? (Array.isArray(user.assignedTeamModules) ? user.assignedTeamModules : [])
      : (Array.isArray(user.assignedLeadModules) ? user.assignedLeadModules : (Array.isArray(user.assignedModules) ? user.assignedModules : []));
    if (assigned.length === 0) return true;

    return assigned.every(mod => {
      const win = getAccessWindowForUserRole(mod, user.role);
      return !isWithinAccessWindow(win.start, win.end);
    });
  }, [user]);

  useEffect(() => {
    if (!user || (user.role !== 'lead' && user.role !== 'team')) return;

    if (shouldAutoLogout) {
      handleLogout();
      return;
    }

    const timer = window.setInterval(() => {
      const storedUser = window.localStorage.getItem('lab-user');
      if (!storedUser) return;

      try {
        const parsed = JSON.parse(storedUser);
        const assigned = parsed?.role === 'team'
          ? (Array.isArray(parsed?.assignedTeamModules) ? parsed.assignedTeamModules : [])
          : (Array.isArray(parsed?.assignedLeadModules) ? parsed.assignedLeadModules : (Array.isArray(parsed?.assignedModules) ? parsed.assignedModules : []));
        const sessionExpired = assigned.length === 0
          || assigned.every(mod => {
            const win = getAccessWindowForUserRole(mod, parsed?.role);
            return !isWithinAccessWindow(win.start, win.end);
          });

        if (sessionExpired) {
          handleLogout();
        }
      } catch {
        handleLogout();
      }
    }, 15000);

    const refreshAccessCapabilities = async () => {
      try {
        const [leadModules, teamModules] = await Promise.all([
          fetchAllModules('lead'),
          fetchAllModules('teams'),
        ]);
        const hasLead = Array.isArray(leadModules) && leadModules.length > 0;
        const hasTeams = Array.isArray(teamModules) && teamModules.length > 0;

        if (!hasLead && !hasTeams) {
          handleLogout();
          return;
        }

        const nextRole = hasLead ? 'lead' : 'team';

        const updatedUser = {
          ...user,
          role: nextRole,
          assignedLeadModules: Array.isArray(leadModules) ? leadModules : [],
          assignedTeamModules: Array.isArray(teamModules) ? teamModules : [],
          assignedModules: nextRole === 'lead' ? (Array.isArray(leadModules) ? leadModules : []) : (Array.isArray(teamModules) ? teamModules : []),
          canAccessLeadView: hasLead,
          canAccessTeamsView: hasTeams,
        };

        window.localStorage.setItem('lab-user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      } catch {
        // Keep current session if refresh fails temporarily.
      }
    };

    refreshAccessCapabilities();
    const syncTimer = window.setInterval(refreshAccessCapabilities, 60000);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(syncTimer);
    };
  }, [shouldAutoLogout, user]);

  const homePath = user?.role === 'admin'
    ? '/admin/modules'
    : user?.canAccessLeadView
      ? '/lead/modules'
      : '/lead/teams-modules';

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user
            ? <Navigate to={homePath} replace />
            : <Login onLogin={handleLogin} />
        }
      />

      <Route
        path="/*"
        element={
          user
            ? <LabManagerRoutes user={user} onLogout={handleLogout} />
            : <Navigate to="/login" replace />
        }
      />
    </Routes>
  );
}
