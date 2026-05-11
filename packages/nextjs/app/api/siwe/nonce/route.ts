import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { generateSiweNonce } from "viem/siwe";
import { SiweSessionData, defaultSession, getSessionOptions } from "~~/utils/siwe";

export async function GET() {
  const session = await getIronSession<SiweSessionData>(await cookies(), getSessionOptions());

  Object.assign(session, defaultSession);
  session.nonce = generateSiweNonce();
  await session.save();

  return NextResponse.json({ nonce: session.nonce });
}
