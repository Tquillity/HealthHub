/**
 * Encryption Utilities for Sensitive Data
 * 
 * Provides encryption/decryption for journal entry sensitive fields
 * to ensure GDPR compliance and data privacy.
 * 
 * Uses Node.js crypto module with AES-256-GCM for authenticated encryption.
 * Encryption key should be stored in ENCRYPTION_KEY environment variable.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 16;

/**
 * Get encryption key from environment variable
 * Falls back to a derived key from BETTER_AUTH_SECRET if ENCRYPTION_KEY is not set
 */
function getEncryptionKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET;
  
  if (!encryptionKey) {
    throw new Error('❌ ENCRYPTION_KEY or BETTER_AUTH_SECRET must be set for encryption');
  }
  
  // Derive a 32-byte key from the secret using scrypt
  return scryptSync(encryptionKey, 'healthhub-salt', KEY_LENGTH);
}

/**
 * Encrypt sensitive text data
 * 
 * @param text - Plain text to encrypt
 * @returns Encrypted text in format: salt:iv:tag:encryptedData (base64 encoded)
 */
export function encrypt(text: string | null | undefined): string | null {
  if (!text) return null;
  
  try {
    const key = getEncryptionKey();
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const tag = cipher.getAuthTag();
    
    // Format: salt:iv:tag:encryptedData (all base64)
    return `${salt.toString('base64')}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`;
  } catch (error) {
    console.error('❌ Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive text data
 * 
 * @param encryptedText - Encrypted text in format: salt:iv:tag:encryptedData
 * @returns Decrypted plain text, or original text if decryption fails (backward compatibility)
 */
export function decrypt(encryptedText: string | null | undefined): string | null {
  if (!encryptedText) return null;
  
  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    
    // If not in encrypted format (salt:iv:tag:data), assume it's plain text (backward compatibility)
    if (parts.length !== 4) {
      return encryptedText;
    }
    
    // We include the `salt` segment for forward/backward compatibility with existing stored values,
    // even though this implementation derives the key from a fixed salt.
    const [_saltBase64, ivBase64, tagBase64, encrypted] = parts;
    
    const iv = Buffer.from(ivBase64, 'base64');
    const tag = Buffer.from(tagBase64, 'base64');
    
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    // If decryption fails, assume data is not encrypted (backward compatibility with existing data)
    // This allows graceful migration from unencrypted to encrypted data
    console.warn('⚠️ Decryption failed, assuming plain text (backward compatibility):', error instanceof Error ? error.message : 'Unknown error');
    return encryptedText;
  }
}

/**
 * Encrypt array of strings
 */
export function encryptArray(items: string[] | null | undefined): string[] | null {
  if (!items || items.length === 0) return null;
  return items.map((item) => encrypt(item)!).filter(Boolean);
}

/**
 * Decrypt array of strings
 * 
 * Handles backward compatibility - if items are not encrypted, returns them as-is
 */
export function decryptArray(encryptedItems: string[] | null | undefined): string[] {
  // Prisma models use `String[]` (non-nullable). Returning `[]` keeps client/server types aligned
  // and avoids `null` leaking into UI state.
  if (!encryptedItems || encryptedItems.length === 0) return [];
  return encryptedItems
    .map((item) => decrypt(item)!)
    .filter((item): item is string => item !== null);
}

