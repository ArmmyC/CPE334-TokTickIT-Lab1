import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const PASSWORD_HASH_VERSION = 'v1';
const SCRYPT_COST = 32_768;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const PASSWORD_SALT_BYTES = 16;
const DERIVED_KEY_BYTES = 32;

export const PASSWORD_POLICY = {
  minLength: 12,
  maxLength: 128,
};

export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_POLICY.minLength) {
    return `Password must be at least ${PASSWORD_POLICY.minLength} characters long.`;
  }
  if (password.length > PASSWORD_POLICY.maxLength) {
    return `Password must be no more than ${PASSWORD_POLICY.maxLength} characters long.`;
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  if (!/[^\p{L}\p{N}\s-]/u.test(password)) {
    return 'Password must contain at least one symbol.';
  }
  return null;
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, DERIVED_KEY_BYTES, {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELIZATION,
      maxmem: SCRYPT_MAX_MEMORY,
    }, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey as Buffer);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const validationError = validatePassword(password);
  if (validationError) {
    throw new Error(validationError);
  }

  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const derivedKey = await deriveKey(password, salt);
  return [
    'scrypt',
    PASSWORD_HASH_VERSION,
    `N=${SCRYPT_COST},r=${SCRYPT_BLOCK_SIZE},p=${SCRYPT_PARALLELIZATION}`,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [algorithm, version, parameters, encodedSalt, encodedKey] = storedHash.split('$');
    if (algorithm !== 'scrypt' || version !== PASSWORD_HASH_VERSION) {
      return false;
    }
    if (parameters !== `N=${SCRYPT_COST},r=${SCRYPT_BLOCK_SIZE},p=${SCRYPT_PARALLELIZATION}`) {
      return false;
    }

    const salt = Buffer.from(encodedSalt, 'base64url');
    const expectedKey = Buffer.from(encodedKey, 'base64url');
    if (salt.length !== PASSWORD_SALT_BYTES || expectedKey.length !== DERIVED_KEY_BYTES) {
      return false;
    }

    const actualKey = await deriveKey(password, salt);
    return timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}
