import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const MAX_MEMORY = 64 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await deriveKey(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: MAX_MEMORY,
  });
  return ['scrypt', COST, BLOCK_SIZE, PARALLELIZATION, salt, derivedKey.toString('hex')].join('$');
}

export async function verifyPassword(
  password: string,
  encodedHash: string | undefined,
): Promise<boolean> {
  if (!encodedHash) return false;
  const [algorithm, cost, blockSize, parallelization, salt, hash] = encodedHash.split('$');
  if (algorithm !== 'scrypt' || !cost || !blockSize || !parallelization || !salt || !hash)
    return false;
  const expected = Buffer.from(hash, 'hex');
  const parameters = {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelization),
    maxmem: MAX_MEMORY,
  };
  if (
    !Number.isSafeInteger(parameters.N) ||
    !Number.isSafeInteger(parameters.r) ||
    !Number.isSafeInteger(parameters.p) ||
    expected.length === 0
  )
    return false;
  try {
    const derivedKey = await deriveKey(password, salt, expected.length, parameters);
    return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey);
  } catch {
    return false;
  }
}

function deriveKey(
  password: string,
  salt: string,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}
