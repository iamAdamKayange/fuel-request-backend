import crypto from 'crypto'
import { env } from '../config/env'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const TAG_POSITION = SALT_LENGTH + IV_LENGTH
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH

const getKey = (salt: Buffer): Buffer => {
  return crypto.pbkdf2Sync(env.ENCRYPTION_KEY, salt, 100000, 32, 'sha512')
}

export const encrypt = (text: string): string => {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = getKey(salt)
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ])
  
  const tag = cipher.getAuthTag()
  
  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64')
}

export const decrypt = (encryptedData: string): string | null => {
  try {
    // Check if data is empty or not a string
    if (!encryptedData || typeof encryptedData !== 'string') {
      return null
    }

    const buffer = Buffer.from(encryptedData, 'base64')
    
    // Check if buffer is too short to contain salt + iv + tag + encrypted data
    const minRequiredLength = SALT_LENGTH + IV_LENGTH + TAG_LENGTH
    if (buffer.length < minRequiredLength) {
      return null
    }
    
    const salt = buffer.subarray(0, SALT_LENGTH)
    const iv = buffer.subarray(SALT_LENGTH, TAG_POSITION)
    const tag = buffer.subarray(TAG_POSITION, ENCRYPTED_POSITION)
    const encrypted = buffer.subarray(ENCRYPTED_POSITION)
    
    const key = getKey(salt)
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    
    return decipher.update(encrypted) + decipher.final('utf8')
  } catch (error) {
    // Return null if decryption fails (data might be corrupted or not encrypted)
    return null
  }
}

export const hash = (text: string): string => {
  return crypto.createHash('sha256').update(text).digest('hex')
}