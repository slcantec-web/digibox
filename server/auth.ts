import { NextFunction, Request, Response } from 'express';
import { db, hashPassword } from './db.js';

export interface AuthenticatedRequest extends Request {
  operator?: {
    id: string;
    organization_id: string;
    username: string;
    role: 'admin' | 'operator';
  };
  organizationId?: string;
}

export function verifyOperatorCredentials(username: string, plainTextPassword: string) {
  const op = db.getOperatorByUsername(username);
  if (!op || op.status !== 'active') {
    return null;
  }
  const computedHash = hashPassword(plainTextPassword, op.password_salt);
  if (computedHash !== op.password_hash) {
    return null;
  }
  return {
    id: op.id,
    organization_id: op.organization_id,
    username: op.username,
    role: op.role,
  };
}

export function requireOperatorAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-session-token']) {
    token = String(req.headers['x-session-token']).trim();
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const session = db.getSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }

  const op = db.getOperatorById(session.operator_id);
  if (!op || op.status !== 'active') {
    return res.status(403).json({ error: 'Operator account is inactive or disabled.' });
  }

  req.operator = {
    id: op.id,
    organization_id: op.organization_id,
    username: op.username,
    role: op.role,
  };
  req.organizationId = op.organization_id;

  next();
}
