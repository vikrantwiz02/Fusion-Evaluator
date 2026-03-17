import mongoose from 'mongoose';
import { OAuth2Client } from 'google-auth-library';
import Admin from '../../../lib/models/Admin.js';
import Module from '../../../lib/models/Module.js';
import User from '../../../lib/models/User.js';
import { serializeModule } from '../../../lib/utils/serializeModule.js';

const oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

// Simple connection handler
const mongooseReady = mongoose.connection.readyState === 1 
  ? Promise.resolve() 
  : mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 1,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

// Check if current time is within login window
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
  
  // Handle case where end time is on next day (e.g., 23:00 to 02:00)
  if (endTotalMin < startTotalMin) {
    return currentTotalMin >= startTotalMin || currentTotalMin <= endTotalMin;
  }
  
  return currentTotalMin >= startTotalMin && currentTotalMin <= endTotalMin;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await mongooseReady;

    if (!process.env.MONGODB_URI || !process.env.GOOGLE_CLIENT_ID) {
      throw new Error('Missing required environment variables');
    }

    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required.' });
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload.email_verified) {
      return res.status(401).json({ error: 'Verified Google email is required.' });
    }

    const normalized = payload.email.trim().toLowerCase();
    const admin = await Admin.findOne({ email: normalized });

    if (admin) {
      await User.findOneAndUpdate(
        { email: normalized },
        {
          email: normalized,
          role: 'admin',
          name: payload.name || '',
          picture: payload.picture || '',
          googleSubject: payload.sub || '',
          lastLoginAt: new Date(),
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      return res.json({
        role: 'admin',
        email: normalized,
        name: payload.name || normalized,
        picture: payload.picture || '',
      });
    }

    const assignedModules = await Module.find({ assigned_leads: { $in: [normalized] } }).sort({ createdAt: 1 });

    if (assignedModules.length > 0) {
      // Check if at least one assigned module is within login window
      const accessibleModules = assignedModules.filter(module =>
        isWithinLoginWindow(module.login_start || '00:00', module.login_end || '23:59')
      );

      if (accessibleModules.length === 0) {
        const nextModule = assignedModules[0];
        return res.status(403).json({
          error: `You are not authorized to login at this time.`,
        });
      }

      await User.findOneAndUpdate(
        { email: normalized },
        {
          email: normalized,
          role: 'lead',
          name: payload.name || '',
          picture: payload.picture || '',
          googleSubject: payload.sub || '',
          lastLoginAt: new Date(),
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      try {
        const serializedModules = accessibleModules.map(mod => {
          try {
            return serializeModule(mod);
          } catch (mapErr) {
            return null;
          }
        }).filter(m => m !== null);
        
        return res.json({
          role: 'lead',
          email: normalized,
          name: payload.name || normalized,
          picture: payload.picture || '',
          assignedModules: serializedModules,
        });
      } catch (serializeErr) {
        throw serializeErr;
      }
    }

    return res.status(403).json({
      error: 'This Google account is not authorized to access the system at this time.',
    });
  } catch (err) {
    console.error('[auth] Error during authentication');
    // Determine appropriate status code
    const statusCode = err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' ? 503 : 500;
    res.status(statusCode).json({ 
      error: 'Authentication failed.'
    });
  }
}
