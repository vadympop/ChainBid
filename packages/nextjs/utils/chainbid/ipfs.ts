import type { ChainBidMetadata } from "~~/types/chainbid";
import { fetchNftMetadata, ipfsToHttp } from "~~/utils/scaffold-eth/ipfs";

export { ipfsToHttp };

const toErc1155UriTokenId = (tokenId?: bigint | number | string) => {
  if (tokenId === undefined || tokenId === null || tokenId === "") return undefined;

  try {
    return BigInt(tokenId).toString(16).padStart(64, "0");
  } catch {
    return undefined;
  }
};

export const resolveTokenUri = (tokenUri: string, tokenId?: bigint | number | string) => {
  const erc1155TokenId = toErc1155UriTokenId(tokenId);

  return erc1155TokenId ? tokenUri.replaceAll("{id}", erc1155TokenId) : tokenUri;
};

export const fetchChainBidMetadata = async (
  tokenUri: string,
  fallback?: { contractAddress?: string; tokenId?: bigint | number | string },
): Promise<ChainBidMetadata> => fetchNftMetadata(resolveTokenUri(tokenUri, fallback?.tokenId), fallback);

export const getMetadataAssetType = (metadata?: ChainBidMetadata) => {
  const attribute = metadata?.attributes.find(item => item.trait_type?.toLowerCase() === "asset type");
  return typeof attribute?.value === "string" ? attribute.value : undefined;
};
