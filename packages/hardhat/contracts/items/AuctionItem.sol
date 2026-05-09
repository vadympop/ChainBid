// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

enum ItemType {
    ERC721,
    ERC1155,
    Physical
}
enum AuctionType {
    English,
    Dutch,
    SealedBid
}
enum AuctionState {
    Active,
    Ended,
    Finalized,
    Cancelled
}

struct AuctionItem {
    ItemType itemType;
    address tokenContract;
    uint256 tokenId;
    uint256 amount;
    string metadataURI;
}
