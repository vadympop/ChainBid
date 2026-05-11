import { useEffect, useState } from "react";
import type { Address } from "viem";
import type { ChainBidMetadata } from "~~/types/chainbid";
import { fetchChainBidMetadata } from "~~/utils/chainbid/ipfs";

export function useChainBidMetadata(
  tokenUri: string | undefined,
  contractAddress: Address | undefined,
  tokenId: bigint | undefined,
): { metadata: ChainBidMetadata | undefined; isLoading: boolean } {
  const [metadata, setMetadata] = useState<ChainBidMetadata>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!tokenUri || !contractAddress || tokenId === undefined) {
      setMetadata(undefined);
      return;
    }
    let ignore = false;
    setIsLoading(true);
    fetchChainBidMetadata(tokenUri, { contractAddress, tokenId }).then(result => {
      if (!ignore) {
        setMetadata(result);
        setIsLoading(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, [tokenUri, contractAddress, tokenId]);

  return { metadata, isLoading };
}
