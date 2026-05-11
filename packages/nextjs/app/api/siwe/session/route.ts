import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SiweSessionData, defaultSession, getSessionOptions } from "~~/utils/siwe";

export async function GET() {
  const session = await getIronSession<SiweSessionData>(await cookies(), getSessionOptions());

  return NextResponse.json({
    isLoggedIn: session.isLoggedIn,
    address: session.address,
    chainId: session.chainId,
  });
}

export async function DELETE() {
  const session = await getIronSession<SiweSessionData>(await cookies(), getSessionOptions());

  Object.assign(session, defaultSession);
  session.destroy();

  return NextResponse.json({ isLoggedIn: false });
}
