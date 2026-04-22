import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SCRYPT_KEY_LENGTH = 64;

function isValidPasswordHashFormat(value: string) {
  const parts = value.split("$");

  return parts.length === 4 && parts[0] === "scrypt";
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;

  return `scrypt$${SCRYPT_KEY_LENGTH}$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  if (!isValidPasswordHashFormat(passwordHash)) {
    return false;
  }

  const [, keyLengthValue, salt, expectedHex] = passwordHash.split("$");
  const keyLength = Number.parseInt(keyLengthValue, 10);

  if (!Number.isFinite(keyLength) || keyLength <= 0) {
    return false;
  }

  const derived = (await scrypt(password, salt, keyLength)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");

  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}
