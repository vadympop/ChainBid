// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

enum TokenType {
    ERC721,
    ERC1155
}

enum AssetType {
    Digital,
    Physical
}

enum AuctionType {
    English,
    Dutch,
    Vickrey
}
enum AuctionState {
    Active,
    Ended,
    Finalized,
    Cancelled
}

struct AuctionItem {
    TokenType tokenType;
    AssetType assetType;
    address tokenContract;
    uint256 tokenId;
    uint256 amount;
    string metadataURI;
}
