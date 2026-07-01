let missingSecretLogged = false;

export function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (!missingSecretLogged) {
      console.error('JWT_SECRET is not configured');
      missingSecretLogged = true;
    }
    return null;
  }
  if (secret.length < 32) {
    if (!missingSecretLogged) {
      console.error('JWT_SECRET must contain at least 32 characters');
      missingSecretLogged = true;
    }
    return null;
  }
  return secret;
}
