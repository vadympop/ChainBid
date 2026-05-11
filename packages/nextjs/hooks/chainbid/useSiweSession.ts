"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSiweMessage } from "viem/siwe";
import { useAccount, useSignMessage } from "wagmi";
import { notification } from "~~/utils/scaffold-eth";

type SiweSessionState = {
  isLoggedIn: boolean;
  address?: string;
  chainId?: number;
};

const fetchSession = async (): Promise<SiweSessionState> => {
  const res = await fetch("/api/siwe/session");
  if (!res.ok) return { isLoggedIn: false };
  return (await res.json()) as SiweSessionState;
};

export const useSiweSession = () => {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [session, setSession] = useState<SiweSessionState>({ isLoggedIn: false });
  const [isLoading, setIsLoading] = useState(false);
  const hasSeenWalletConnected = useRef(false);

  useEffect(() => {
    fetchSession().then(setSession);
  }, []);

  useEffect(() => {
    if (isConnected) {
      hasSeenWalletConnected.current = true;
    }
    if (!isConnected && hasSeenWalletConnected.current && session.isLoggedIn) {
      fetch("/api/siwe/session", { method: "DELETE" }).then(() => {
        setSession({ isLoggedIn: false });
      });
    }
  }, [isConnected, session.isLoggedIn]);

  const signIn = useCallback(async (): Promise<boolean> => {
    if (!address || !chainId) {
      notification.error("Connect your wallet before signing in.");
      return false;
    }

    setIsLoading(true);
    try {
      const nonceRes = await fetch("/api/siwe/nonce");
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      const message = createSiweMessage({
        address,
        chainId,
        domain: window.location.host,
        nonce,
        uri: window.location.origin,
        version: "1",
        statement: "Sign in to ChainBid to upload auction items.",
      });

      const signature = await signMessageAsync({ message });

      const verifyRes = await fetch("/api/siwe/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });

      if (!verifyRes.ok) {
        const { error } = (await verifyRes.json()) as { error: string };
        notification.error(error || "Sign-in failed.");
        return false;
      }

      const result = (await verifyRes.json()) as SiweSessionState;
      setSession({ isLoggedIn: true, address: result.address, chainId: result.chainId });
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes("User rejected")) {
        notification.error("Signature request rejected.");
      } else {
        notification.error("Sign-in failed.");
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, signMessageAsync]);

  const signOut = useCallback(async () => {
    await fetch("/api/siwe/session", { method: "DELETE" });
    setSession({ isLoggedIn: false });
  }, []);

  return { session, isLoading, signIn, signOut };
};
