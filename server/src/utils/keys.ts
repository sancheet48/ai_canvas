import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

let privateKey: string = process.env.JWT_PRIVATE_KEY || '';
let publicKey: string = process.env.JWT_PUBLIC_KEY || '';

if (!privateKey || !publicKey) {
  console.warn('JWT_PRIVATE_KEY or JWT_PUBLIC_KEY not found in environment.');
  console.warn('Generating ephemeral 2048-bit RSA key pair for development...');
  try {
    const { privateKey: priv, publicKey: pub } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    privateKey = priv;
    publicKey = pub;
    console.log('Ephemeral RSA key pair generated successfully.');
  } catch (err) {
    console.error('Failed to generate ephemeral RSA key pair:', err);
    // Absolute fallback to mock string for stability (will sign as HS256 if RSA fails, but RSA shouldn't fail)
    privateKey = 'fallback-private-key';
    publicKey = 'fallback-public-key';
  }
}

// Helper to determine if we should sign with RS256 or HS256 fallback
export const getJwtAlgorithm = (): 'RS256' | 'HS256' => {
  if (privateKey.includes('BEGIN PRIVATE KEY') || privateKey.includes('BEGIN RSA PRIVATE KEY')) {
    return 'RS256';
  }
  return 'HS256';
};

export { privateKey, publicKey };
