import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import config from '../config.js';
import { serializeModule } from '../utils/serializeModule.js';
import { isWithinLoginWindow } from '../utils/time.js';
import { ForbiddenError, UnauthorizedError } from '../errors.js';

const oauthClient = new OAuth2Client(config.googleClientId);

const WITH_GROUPS = { groups: { orderBy: { created_at: 'asc' } } };

async function verifyGoogleToken(credential) {
  const ticket = await oauthClient.verifyIdToken({
    idToken: credential,
    audience: config.googleClientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified) {
    throw new UnauthorizedError('A verified Google email is required.');
  }
  return payload;
}

function issueToken(role, email) {
  return jwt.sign({ role, email }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

async function upsertUser(email, role, googlePayload) {
  return prisma.user.upsert({
    where: { email },
    update: {
      role,
      name: googlePayload.name || '',
      picture: googlePayload.picture || '',
      google_subject: googlePayload.sub || '',
      last_login_at: new Date(),
    },
    create: {
      email,
      role,
      name: googlePayload.name || '',
      picture: googlePayload.picture || '',
      google_subject: googlePayload.sub || '',
      last_login_at: new Date(),
    },
  });
}

export async function loginWithGoogle(credential) {
  const payload = await verifyGoogleToken(credential);
  const email = payload.email.trim().toLowerCase();

  const admin = await prisma.admin.findUnique({ where: { email } });

  if (admin) {
    await upsertUser(email, 'admin', payload);
    const token = issueToken('admin', email);
    return { token, role: 'admin', email, name: payload.name || email, picture: payload.picture || '' };
  }

  const assignedModules = await prisma.module.findMany({
    where: { assigned_leads: { has: email } },
    include: WITH_GROUPS,
    orderBy: { week_num: 'asc' },
  });

  if (assignedModules.length === 0) {
    throw new ForbiddenError('This Google account is not authorized to access the system.');
  }

  const accessibleModules = assignedModules.filter(m =>
    isWithinLoginWindow(m.login_start || '00:00', m.login_end || '23:59')
  );

  if (accessibleModules.length === 0) {
    throw new ForbiddenError('You are not authorized to login at this time.');
  }

  await upsertUser(email, 'lead', payload);
  const token = issueToken('lead', email);

  return {
    token,
    role: 'lead',
    email,
    name: payload.name || email,
    picture: payload.picture || '',
    assignedModules: accessibleModules.map(serializeModule).filter(Boolean),
  };
}
