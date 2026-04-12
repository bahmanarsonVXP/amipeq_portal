import { SignJWT, jwtVerify } from 'jose';

export interface SupabaseJwtPayload {
  sub: string;
  email: string;
  role?: string;
  aud?: string;
  [key: string]: any;
}

export async function signToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(secret));
}

export async function verifyToken(token: string, secret: string): Promise<SupabaseJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload as unknown as SupabaseJwtPayload;
  } catch {
    return null;
  }
}
