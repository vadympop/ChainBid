import { SessionOptions } from "iron-session";

export type SiweSessionData = {
  nonce?: string;
  address?: string;
  chainId?: number;
  isLoggedIn: boolean;
};

export const defaultSession: SiweSessionData = { isLoggedIn: false };

export function getSessionOptions(): SessionOptions {
  const secret = process.env.IRON_SESSION_SECRET;
  const password =
    secret && secret.length >= 32
      ? secret
      : process.env.NODE_ENV === "production"
        ? (() => {
            throw new Error("IRON_SESSION_SECRET must be set in production (32+ chars)");
          })()
        : "chainbid_dev_session_secret_32chars_min";

  return {
    password,
    cookieName: "chainbid-siwe",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60,
    },
  };
}
