"use client";

import { useAccount, useWriteContract } from "wagmi";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

type WriteContractAsync = ReturnType<typeof useWriteContract>["writeContractAsync"];
type WriteContractRequest = Parameters<WriteContractAsync>[0] & { chainId?: number };
type WriteContractOptions = Parameters<WriteContractAsync>[1];

export const useChainBidWriteContract = () => {
  const { chain } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const wagmiWriteContract = useWriteContract();

  const writeContractAsync = async (request: WriteContractRequest, options?: WriteContractOptions) => {
    if (!chain?.id) {
      notification.error("Please connect your wallet");
      return;
    }

    if (chain.id !== targetNetwork.id) {
      notification.error(`Wallet is connected to the wrong network. Please switch to ${targetNetwork.name}`);
      return;
    }

    return wagmiWriteContract.writeContractAsync({ ...request, chainId: targetNetwork.id }, options);
  };

  return {
    ...wagmiWriteContract,
    writeContractAsync,
  };
};
