import React, { useEffect, useMemo, useState } from 'react';
import Login from '../../Modules/Auth/Login';
import LabManagerRoutes from '../LabManagerRoutes';
import { fetchAllModules } from '../../Modules/LabManager/api';

const APP_TIMEZONE = import.meta.env.VITE_APP_TIMEZONE || 'Asia/Kolkata';

function parseTimeToMinutes(value, fallback) {
  if (!value || typeof value !== 'string') return fallback;

  const raw = value.trim().toUpperCase();
  const m = raw.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/);
  if (!m) return fallback;

  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const period = m[3];

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) {
    return fallback;
  }

  if (period) {
    if (hour < 1 || hour > 12) return fallback;
    if (period === 'AM') {
      hour = hour % 12;
    } else {
      hour = (hour % 12) + 12;
    }
  }

  if (hour < 0 || hour > 23) return fallback;
  return hour * 60 + minute;
}

function getCurrentMinutesInTimezone(timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

function isWithinLoginWindow(loginStart, loginEnd) {
  const startTotalMin = parseTimeToMinutes(loginStart, 0);
  const endTotalMin = parseTimeToMinutes(loginEnd, 23 * 60 + 59);
  const currentTotalMin = getCurrentMinutesInTimezone(APP_TIMEZONE);

  if (endTotalMin < startTotalMin) {
    return currentTotalMin >= startTotalMin || currentTotalMin <= endTotalMin;
  }

  return currentTotalMin >= startTotalMin && currentTotalMin <= endTotalMin;
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

    return assigned.every(mod => !isWithinLoginWindow(mod.login_start || '00:00', mod.login_end || '23:59'));
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
          || assigned.every(mod => !isWithinLoginWindow(mod.login_start || '00:00', mod.login_end || '23:59'));

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
