export const erc721Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getApproved",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export const erc1155Abi = [
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "uri",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

const auctionItemComponents = [
  { name: "tokenType", type: "uint8" },
  { name: "assetType", type: "uint8" },
  { name: "tokenContract", type: "address" },
  { name: "tokenId", type: "uint256" },
  { name: "amount", type: "uint256" },
  { name: "metadataURI", type: "string" },
] as const;

const baseAuctionAbi = [
  {
    type: "function",
    name: "confirmReceived",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "finalize",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "isAwaitingConfirmation",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "pendingReturns",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

export const englishAuctionAbi = [
  ...baseAuctionAbi,
  {
    type: "function",
    name: "bid",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "getAuctionInfo",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "item", type: "tuple", components: auctionItemComponents },
          { name: "seller", type: "address" },
          { name: "endTime", type: "uint256" },
          { name: "finalized", type: "bool" },
          { name: "reservePrice", type: "uint256" },
          { name: "highestBidder", type: "address" },
          { name: "highestBid", type: "uint256" },
          { name: "winner", type: "address" },
          { name: "finalPrice", type: "uint256" },
          { name: "receivedConfirmed", type: "bool" },
        ],
      },
    ],
  },
] as const;

export const dutchAuctionAbi = [
  ...baseAuctionAbi,
  {
    type: "function",
    name: "buy",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "getCurrentPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getAuctionInfo",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "item", type: "tuple", components: auctionItemComponents },
          { name: "seller", type: "address" },
          { name: "endTime", type: "uint256" },
          { name: "finalized", type: "bool" },
          { name: "reservePrice", type: "uint256" },
          { name: "startPrice", type: "uint256" },
          { name: "duration", type: "uint256" },
          { name: "startTime", type: "uint256" },
          { name: "currentPrice", type: "uint256" },
          { name: "winner", type: "address" },
          { name: "finalPrice", type: "uint256" },
          { name: "receivedConfirmed", type: "bool" },
        ],
      },
    ],
  },
] as const;
