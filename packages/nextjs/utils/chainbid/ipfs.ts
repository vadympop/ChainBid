import type { ChainBidMetadata } from "~~/types/chainbid";
import { fetchNftMetadata, ipfsToHttp } from "~~/utils/scaffold-eth/ipfs";

export { ipfsToHttp };

export const fetchChainBidMetadata = async (
  tokenUri: string,
  fallback?: { contractAddress?: string; tokenId?: bigint | number | string },
): Promise<ChainBidMetadata> => fetchNftMetadata(tokenUri, fallback);

export const getMetadataAssetType = (metadata?: ChainBidMetadata) => {
  const attribute = metadata?.attributes.find(item => item.trait_type?.toLowerCase() === "asset type");
  return typeof attribute?.value === "string" ? attribute.value : undefined;
};
