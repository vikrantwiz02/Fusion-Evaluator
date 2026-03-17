import React, { useEffect, useMemo, useState } from 'react';
import Login from '../../Modules/Auth/Login';
import LabManagerRoutes from '../LabManagerRoutes';
import { fetchAllModules } from '../../Modules/LabManager/api';

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

  const shouldAutoLogout = useMemo(() => {
    if (!user || user.role !== 'lead') return false;

    const assigned = Array.isArray(user.assignedModules) ? user.assignedModules : [];
    if (assigned.length === 0) return true;

    return assigned.every(mod => !isWithinAccessWindow(mod.access_start ?? null, mod.access_end ?? null));
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'lead') return;

    if (shouldAutoLogout) {
      handleLogout();
      return;
    }

    const timer = window.setInterval(() => {
      const storedUser = window.localStorage.getItem('lab-user');
      if (!storedUser) return;

      try {
        const parsed = JSON.parse(storedUser);
        const assigned = Array.isArray(parsed?.assignedModules) ? parsed.assignedModules : [];
        const sessionExpired = assigned.length === 0
          || assigned.every(mod => !isWithinAccessWindow(mod.access_start ?? null, mod.access_end ?? null));

        if (sessionExpired) {
          handleLogout();
        }
      } catch {
        handleLogout();
      }
    }, 15000);

    const syncTimer = window.setInterval(async () => {
      try {
        const freshAssignedModules = await fetchAllModules();
        const assigned = Array.isArray(freshAssignedModules) ? freshAssignedModules : [];

        if (assigned.length === 0) {
          handleLogout();
          return;
        }

        const updatedUser = {
          ...user,
          assignedModules: assigned,
        };

        window.localStorage.setItem('lab-user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      } catch {
        // Keep current session if refresh fails temporarily.
      }
    }, 60000);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(syncTimer);
    };
  }, [shouldAutoLogout, user]);

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return <LabManagerRoutes user={user} onLogout={handleLogout} />;
}
