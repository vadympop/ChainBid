import crypto from "crypto";
import { SessionOptions } from "iron-session";

export type SiweSessionData = {
  nonce?: string;
  address?: string;
  chainId?: number;
  isLoggedIn: boolean;
};

export const defaultSession: SiweSessionData = { isLoggedIn: false };

// Generated once per process start when IRON_SESSION_SECRET is absent.
// Sessions are invalidated on every restart, which is acceptable for local
// dev but surfaces misconfiguration immediately in staging/preview.
let _ephemeralSecret: string | undefined;

function getPassword(): string {
  const secret = process.env.IRON_SESSION_SECRET;

  if (secret && secret.length >= 32) return secret;

  if (secret) {
    throw new Error("IRON_SESSION_SECRET must be at least 32 characters.");
  }

  if (!_ephemeralSecret) {
    _ephemeralSecret = crypto.randomBytes(32).toString("hex");
    console.warn(
      "[chainbid] IRON_SESSION_SECRET is not set. " +
        "A random session secret has been generated for this process. " +
        "All sessions will be invalidated on restart. " +
        "Set IRON_SESSION_SECRET in .env.local to persist sessions.",
    );
  }

  return _ephemeralSecret;
}

export function getSessionOptions(): SessionOptions {
  return {
    password: getPassword(),
    cookieName: "chainbid-siwe",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60,
    },
  };
}
