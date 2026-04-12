/**
 * Génère un JWT HS256 compatible avec verifyToken() du gateway (même secret que Supabase).
 * Usage : depuis gateway/, avec SUPABASE_JWT_SECRET dans l'environnement :
 *   node scripts/sign-test-jwt.mjs
 */
import { SignJWT } from 'jose';

const secret = process.env.SUPABASE_JWT_SECRET;
if (!secret) {
  console.error('SUPABASE_JWT_SECRET manquant (export ou gateway/.env)');
  process.exit(1);
}

const token = await new SignJWT({
  sub: 'test-local-gateway',
  email: 'test@local.dev',
  role: 'authenticated',
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('1h')
  .sign(new TextEncoder().encode(secret));

console.log(token);
