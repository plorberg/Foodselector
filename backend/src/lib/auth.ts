import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not set. Set it in the environment before starting the server."
  );
}
const secret: string = JWT_SECRET;

const TOKEN_TTL = "30d";

export type JwtPayload = { userId: string; email: string };

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, secret, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === "object" && decoded && "userId" in decoded && "email" in decoded) {
      return { userId: String(decoded.userId), email: String(decoded.email) };
    }
    return null;
  } catch {
    return null;
  }
}

export type GoogleIdentity = { googleId: string; email: string; name: string | null };

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Verifies a Google ID token (from Google Identity Services) and returns the
// identity, or null if invalid / email not verified.
export async function verifyGoogleCredential(credential: string): Promise<GoogleIdentity | null> {
  if (!process.env.GOOGLE_CLIENT_ID) return null;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified === false) return null;
    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name ?? null,
    };
  } catch {
    return null;
  }
}
