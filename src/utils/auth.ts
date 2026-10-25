/**
 * Returns the JWT secret from the environment.
 * Throws at runtime if the variable is missing so misconfiguration
 * is caught immediately rather than silently falling back to a weak key.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is not set. ' +
      'Please add a strong secret to your .env file.'
    );
  }
  return secret;
}

// Web Crypto API signature helper for Next.js Edge Runtime compatibility
export async function signJWT(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  
  // Safe base64url encoding
  const encodeBase64Url = (str: string) => {
    return btoa(str)
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  };

  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const expiry = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days expiration
  const encodedPayload = encodeBase64Url(JSON.stringify({ ...payload, exp: expiry }));
  
  const tokenInput = `${encodedHeader}.${encodedPayload}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(tokenInput));
  
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
    
  return `${tokenInput}.${encodedSignature}`;
}

export async function verifyJWT(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const tokenInput = `${header}.${payload}`;
    
    // Decode base64url to binary
    const decodeBase64Url = (str: string) => {
      const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      const padLen = (4 - (base64.length % 4)) % 4;
      const padded = base64 + '='.repeat(padLen);
      return atob(padded);
    };

    const binarySign = decodeBase64Url(signature);
    const signBuffer = new Uint8Array(binarySign.length);
    for (let i = 0; i < binarySign.length; i++) {
      signBuffer[i] = binarySign.charCodeAt(i);
    }
    
    const isValid = await crypto.subtle.verify('HMAC', key, signBuffer, enc.encode(tokenInput));
    if (!isValid) return null;
    
    const decodedPayload = JSON.parse(decodeBase64Url(payload));
    if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    
    return decodedPayload;
  } catch (e) {
    return null;
  }
}
