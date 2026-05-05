import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import type { Config } from '../config.js';

export interface SessionClaims {
  sub: string;
}

const ALGORITHM = 'HS256';

function keyToBytes(key: string): Uint8Array {
  return new TextEncoder().encode(key);
}

export async function issueJwt(config: Config, userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuer(config.JWT_ISSUER)
    .setAudience(config.JWT_AUDIENCE)
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + config.JWT_TTL_SECONDS)
    .sign(keyToBytes(config.JWT_SIGNING_KEY));
}

export async function verifyJwt(config: Config, token: string): Promise<SessionClaims> {
  const keys = [config.JWT_SIGNING_KEY, config.JWT_PREVIOUS_SIGNING_KEY].filter(
    (k): k is string => typeof k === 'string' && k.length > 0,
  );

  let lastErr: unknown;
  for (const key of keys) {
    try {
      const { payload } = await jwtVerify(token, keyToBytes(key), {
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      });
      if (typeof payload.sub !== 'string') {
        throw new Error('jwt missing sub');
      }
      return { sub: payload.sub };
    } catch (err) {
      lastErr = err;
      if (
        !(err instanceof joseErrors.JWSSignatureVerificationFailed) &&
        !(err instanceof joseErrors.JWSInvalid)
      ) {
        throw err;
      }
    }
  }
  throw lastErr ?? new Error('jwt verification failed');
}
