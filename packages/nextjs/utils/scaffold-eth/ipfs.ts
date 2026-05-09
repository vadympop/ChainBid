export const IPFS_GATEWAY_BASE_URL = "https://gateway.pinata.cloud/ipfs";

export const NFT_METADATA_PLACEHOLDER_IMAGE = "/thumbnail.jpg";

export type NftMetadataAttribute = {
  trait_type?: string;
  value?: string | number | boolean | null;
  [key: string]: unknown;
};

export type NftMetadata = {
  name: string;
  description: string;
  image: string;
  images: string[];
  attributes: NftMetadataAttribute[];
  contractAddress?: string;
  tokenId?: string;
  fetchError?: string;
  raw?: Record<string, unknown>;
};

export type FetchNftMetadataFallback = {
  contractAddress?: string;
  tokenId?: bigint | number | string;
};

const stringifyTokenId = (tokenId?: bigint | number | string) => {
  if (tokenId === undefined || tokenId === null || tokenId === "") {
    return undefined;
  }

  return tokenId.toString();
};

const extractTokenIdFromUri = (uri: string) => {
  const tokenId = uri.match(/(?:\/|#)(\d+)(?:\.[a-z0-9]+)?(?:\?.*)?$/i)?.[1];

  return tokenId;
};

const fallbackName = (tokenId?: string) => `Token #${tokenId || "Unknown"}`;

const failedFetchFallback = (tokenUri: string, error: unknown, fallback?: FetchNftMetadataFallback): NftMetadata => {
  const tokenId = stringifyTokenId(fallback?.tokenId) || extractTokenIdFromUri(tokenUri);
  const contractAddress = fallback?.contractAddress;
  const details = [
    contractAddress ? `Contract: ${contractAddress}` : undefined,
    tokenId ? `Token ID: ${tokenId}` : undefined,
  ].filter(Boolean);
  const fetchError = error instanceof Error ? error.message : "Unable to fetch token metadata.";

  return {
    name: fallbackName(tokenId),
    description: details.join(" | "),
    image: NFT_METADATA_PLACEHOLDER_IMAGE,
    images: [NFT_METADATA_PLACEHOLDER_IMAGE],
    attributes: [],
    contractAddress,
    tokenId,
    fetchError,
  };
};

export const ipfsToHttp = (uri: string): string => {
  const trimmedUri = uri.trim();

  if (!/^ipfs:\/\//i.test(trimmedUri)) {
    return trimmedUri;
  }

  const path = trimmedUri.replace(/^ipfs:\/\/(?:ipfs\/)?/i, "");

  return `${IPFS_GATEWAY_BASE_URL}/${path}`;
};

export const fetchNftMetadata = async (tokenUri: string, fallback?: FetchNftMetadataFallback): Promise<NftMetadata> => {
  const tokenId = stringifyTokenId(fallback?.tokenId) || extractTokenIdFromUri(tokenUri);

  try {
    const response = await fetch(ipfsToHttp(tokenUri));

    if (!response.ok) {
      throw new Error(`Metadata request failed with ${response.status}.`);
    }

    const raw = (await response.json()) as Record<string, unknown>;
    const image = typeof raw.image === "string" && raw.image.trim() ? ipfsToHttp(raw.image.trim()) : "";
    const rawImages = Array.isArray(raw.images) ? raw.images : [];
    const images = rawImages
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map(imageUri => ipfsToHttp(imageUri.trim()));
    const attributes = Array.isArray(raw.attributes)
      ? raw.attributes.filter(
          (attribute): attribute is NftMetadataAttribute => typeof attribute === "object" && attribute !== null,
        )
      : [];

    return {
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : fallbackName(tokenId),
      description: typeof raw.description === "string" ? raw.description : "",
      image: image || images[0] || NFT_METADATA_PLACEHOLDER_IMAGE,
      images: images.length > 0 ? images : [image || NFT_METADATA_PLACEHOLDER_IMAGE],
      attributes,
      contractAddress: fallback?.contractAddress,
      tokenId,
      raw,
    };
  } catch (error) {
    return failedFetchFallback(tokenUri, error, fallback);
  }
};
