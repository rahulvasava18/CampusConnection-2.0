import { createPrivateKey, createPublicKey, createSign, generateKeyPairSync } from 'node:crypto';
import { existsSync, openSync, readFileSync, closeSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import type { PlatformRole } from '@campusconnection/shared';
import { getEnv } from '../../../config/env';

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  fid: string;
  roles: PlatformRole[];
}

export interface VerifiedAccessToken extends AccessTokenClaims {
  iat: number;
  exp: number;
  iss: string;
  aud: string | string[];
}

let generatedKeys: { privateKey: string; publicKey: string } | undefined;

const developmentKeyPath = path.join(os.tmpdir(), 'campusconnection-dev-jwt-keys.json');
const developmentLockPath = `${developmentKeyPath}.lock`;

function readDevelopmentKeys(): { privateKey: string; publicKey: string } | undefined {
  if (!existsSync(developmentKeyPath)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(developmentKeyPath, 'utf8')) as Partial<{
      privateKey: string;
      publicKey: string;
    }>;
    if (typeof parsed.privateKey !== 'string' || typeof parsed.publicKey !== 'string')
      return undefined;
    return { privateKey: parsed.privateKey, publicKey: parsed.publicKey };
  } catch {
    return undefined;
  }
}

function getDevelopmentKeys(): { privateKey: string; publicKey: string } {
  const existing = readDevelopmentKeys();
  if (existing) return existing;

  let lockFd: number | undefined;
  try {
    try {
      lockFd = openSync(developmentLockPath, 'wx');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const ready = readDevelopmentKeys();
        if (ready) return ready;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
      }
      throw new Error('Timed out waiting for the shared development JWT keypair.');
    }

    const afterLock = readDevelopmentKeys();
    if (afterLock) return afterLock;
    const pair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
      publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    });
    writeFileSync(
      developmentKeyPath,
      JSON.stringify({ privateKey: pair.privateKey, publicKey: pair.publicKey }),
      { encoding: 'utf8', mode: 0o600 },
    );
    return { privateKey: pair.privateKey, publicKey: pair.publicKey };
  } finally {
    if (lockFd !== undefined) {
      closeSync(lockFd);
      unlinkSync(developmentLockPath);
    }
  }
}

function getKeys(): { privateKey: string; publicKey: string } {
  const env = getEnv();
  const configured = loadConfiguredKeys(env);
  if (configured) {
    validateKeyPair(configured);
    return configured;
  }
  if (!generatedKeys) generatedKeys = getDevelopmentKeys();
  return generatedKeys;
}

function loadConfiguredKeys(
  env: ReturnType<typeof getEnv>,
): { privateKey: string; publicKey: string } | undefined {
  const hasInlineKeys = Boolean(env.JWT_ACCESS_PRIVATE_KEY || env.JWT_ACCESS_PUBLIC_KEY);
  const hasFileKeys = Boolean(env.JWT_ACCESS_PRIVATE_KEY_FILE || env.JWT_ACCESS_PUBLIC_KEY_FILE);
  if (!hasInlineKeys && !hasFileKeys) return undefined;
  if (hasInlineKeys && (!env.JWT_ACCESS_PRIVATE_KEY || !env.JWT_ACCESS_PUBLIC_KEY)) {
    throw new Error('Both JWT_ACCESS_PRIVATE_KEY and JWT_ACCESS_PUBLIC_KEY must be configured.');
  }
  if (hasFileKeys && (!env.JWT_ACCESS_PRIVATE_KEY_FILE || !env.JWT_ACCESS_PUBLIC_KEY_FILE)) {
    throw new Error(
      'Both JWT_ACCESS_PRIVATE_KEY_FILE and JWT_ACCESS_PUBLIC_KEY_FILE must be configured.',
    );
  }

  try {
    const privateKey = env.JWT_ACCESS_PRIVATE_KEY_FILE
      ? readFileSync(resolveKeyPath(env.JWT_ACCESS_PRIVATE_KEY_FILE), 'utf8')
      : env.JWT_ACCESS_PRIVATE_KEY;
    const publicKey = env.JWT_ACCESS_PUBLIC_KEY_FILE
      ? readFileSync(resolveKeyPath(env.JWT_ACCESS_PUBLIC_KEY_FILE), 'utf8')
      : env.JWT_ACCESS_PUBLIC_KEY;
    if (!privateKey || !publicKey) throw new Error('Both JWT key materials are empty.');
    return { privateKey: normalizePem(privateKey), publicKey: normalizePem(publicKey) };
  } catch (error) {
    if (error instanceof Error && error.message.includes('JWT key materials')) throw error;
    throw new Error('Unable to load configured JWT key files.', { cause: error });
  }
}

function resolveKeyPath(value: string): string {
  if (path.isAbsolute(value)) return value;
  const currentDirectoryPath = path.resolve(process.cwd(), value);
  if (existsSync(currentDirectoryPath)) return currentDirectoryPath;
  const workspaceBackendPath = path.resolve(process.cwd(), 'backend', value);
  if (existsSync(workspaceBackendPath)) return workspaceBackendPath;
  return currentDirectoryPath;
}

function normalizePem(value: string): string {
  return value.trim().replace(/\\n/g, '\n');
}

function validateKeyPair(keys: { privateKey: string; publicKey: string }): void {
  try {
    const privateKey = createPrivateKey(keys.privateKey);
    const publicKey = createPublicKey(keys.publicKey);
    if (privateKey.asymmetricKeyType !== 'rsa' || publicKey.asymmetricKeyType !== 'rsa') {
      throw new Error('JWT keys must be RSA keys.');
    }
    const derivedPublicKey = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
    const configuredPublicKey = publicKey.export({ type: 'spki', format: 'der' });
    if (!derivedPublicKey.equals(configuredPublicKey)) {
      throw new Error('JWT private and public keys do not form a pair.');
    }
    createSign('RSA-SHA256').update('campusconnection-jwt-key-validation').sign(privateKey);
  } catch (error) {
    throw new Error('Configured JWT RSA key pair is invalid.', { cause: error });
  }
}

export function validateJwtKeys(): void {
  const env = getEnv();
  const configured = loadConfiguredKeys(env);
  validateKeyPair(configured ?? getDevelopmentKeys());
}

export function signAccessToken(claims: AccessTokenClaims): string {
  const env = getEnv();
  const options: SignOptions = {
    algorithm: 'RS256',
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    keyid: env.JWT_KEY_ID,
    subject: claims.sub,
  };
  return jwt.sign(
    { sid: claims.sid, fid: claims.fid, roles: claims.roles },
    getKeys().privateKey,
    options,
  );
}

export function verifyAccessToken(token: string): VerifiedAccessToken {
  const env = getEnv();
  const decoded = jwt.verify(token, getKeys().publicKey, {
    algorithms: ['RS256'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  }) as JwtPayload & { sid?: unknown; fid?: unknown; roles?: unknown };
  if (
    typeof decoded.sub !== 'string' ||
    typeof decoded.sid !== 'string' ||
    typeof decoded.fid !== 'string' ||
    !Array.isArray(decoded.roles) ||
    !decoded.iat ||
    !decoded.exp ||
    !decoded.iss ||
    !decoded.aud
  ) {
    throw new Error('Invalid access token claims');
  }
  return {
    sub: decoded.sub,
    sid: decoded.sid,
    fid: decoded.fid,
    roles: decoded.roles as PlatformRole[],
    iat: decoded.iat,
    exp: decoded.exp,
    iss: decoded.iss,
    aud: decoded.aud,
  };
}
