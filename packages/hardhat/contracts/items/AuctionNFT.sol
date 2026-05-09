// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract AuctionNFT is ERC721URIStorage {
    uint256 private _nextTokenId;

    constructor() ERC721("ChainBid Item", "CBI") {}

    function mint(address to, string memory tokenURI_) external returns (uint256) {
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);

        return tokenId;
    }
}
