import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { type Chain, createPublicClient, http } from "viem";
import { arbitrum, base, hardhat, mainnet, optimism, sepolia } from "viem/chains";
import { parseSiweMessage, verifySiweMessage } from "viem/siwe";
import { SiweSessionData, getSessionOptions } from "~~/utils/siwe";

const SUPPORTED_CHAINS: Record<number, Chain> = {
  [hardhat.id]: hardhat,
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
  [base.id]: base,
  [optimism.id]: optimism,
  [arbitrum.id]: arbitrum,
};

export async function POST(request: Request) {
  const session = await getIronSession<SiweSessionData>(await cookies(), getSessionOptions());

  let message: string;
  let signature: string;

  try {
    ({ message, signature } = (await request.json()) as { message: string; signature: string });
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!message || !signature) {
    return NextResponse.json({ error: "message and signature are required." }, { status: 400 });
  }

  const expectedDomain = request.headers.get("host");
  if (!expectedDomain) {
    return NextResponse.json({ error: "Missing Host header." }, { status: 400 });
  }

  let parsed: ReturnType<typeof parseSiweMessage>;
  try {
    parsed = parseSiweMessage(message);
  } catch {
    return NextResponse.json({ error: "Malformed SIWE message." }, { status: 400 });
  }

  if (!parsed.chainId) {
    return NextResponse.json({ error: "SIWE message is missing chainId." }, { status: 400 });
  }

  if (!parsed.address) {
    return NextResponse.json({ error: "SIWE message is missing address." }, { status: 400 });
  }

  const chain = SUPPORTED_CHAINS[parsed.chainId];
  if (!chain) {
    return NextResponse.json({ error: "Unsupported chain." }, { status: 400 });
  }

  const client = createPublicClient({ chain, transport: http() });

  try {
    const valid = await verifySiweMessage(client, {
      message,
      signature: signature as `0x${string}`,
      nonce: session.nonce,
      domain: expectedDomain,
    });

    if (!valid) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Signature verification failed." }, { status: 401 });
  }

  session.isLoggedIn = true;
  session.address = parsed.address;
  session.chainId = parsed.chainId;
  session.nonce = undefined;
  await session.save();

  return NextResponse.json({ address: session.address, chainId: session.chainId });
}
