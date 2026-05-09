// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "../items/AuctionItem.sol";
import "../auctions/EnglishAuction.sol";
import "../auctions/DutchAuction.sol";

contract AuctionFactory {
    struct AuctionRecord {
        address contractAddress;
        AuctionType auctionType;
        address seller;
        uint256 createdAt;
    }

    AuctionRecord[] public allAuctions;
    mapping(address => address[]) public sellerAuctions;

    address public immutable englishImpl;
    address public immutable dutchImpl;

    event AuctionCreated(address indexed contractAddress, AuctionType auctionType, address indexed seller);

    constructor() {
        englishImpl = address(new EnglishAuction());
        dutchImpl = address(new DutchAuction());
    }

    function createEnglishAuction(
        AuctionItem memory item,
        uint256 reservePrice,
        uint256 duration
    ) external returns (address) {
        address clone = Clones.clone(englishImpl);
        EnglishAuction(clone).initialize(item, payable(msg.sender), duration, reservePrice);
        _escrowItem(item, msg.sender, clone);

        _register(clone, AuctionType.English, msg.sender);
        return clone;
    }

    function createDutchAuction(
        AuctionItem memory item,
        uint256 startPrice,
        uint256 reservePrice,
        uint256 duration
    ) external returns (address) {
        address clone = Clones.clone(dutchImpl);
        DutchAuction(clone).initialize(item, payable(msg.sender), startPrice, reservePrice, duration);
        _escrowItem(item, msg.sender, clone);

        _register(clone, AuctionType.Dutch, msg.sender);
        return clone;
    }

    function _escrowItem(AuctionItem memory item, address seller, address auctionAddress) internal {
        if (item.itemType == ItemType.ERC721) {
            IERC721(item.tokenContract).transferFrom(seller, auctionAddress, item.tokenId);
        } else if (item.itemType == ItemType.ERC1155) {
            IERC1155(item.tokenContract).safeTransferFrom(seller, auctionAddress, item.tokenId, item.amount, "");
        }
    }

    function _register(address auctionAddress, AuctionType auctionType, address seller) internal {
        allAuctions.push(
            AuctionRecord({
                contractAddress: auctionAddress,
                auctionType: auctionType,
                seller: seller,
                createdAt: block.timestamp
            })
        );

        sellerAuctions[seller].push(auctionAddress);

        emit AuctionCreated(auctionAddress, auctionType, seller);
    }

    function getAllAuctions() external view returns (AuctionRecord[] memory) {
        return allAuctions;
    }

    function getAuctionsBySeller(address seller) external view returns (address[] memory) {
        return sellerAuctions[seller];
    }

    function getAuctionsPaginated(uint256 offset, uint256 limit) external view returns (AuctionRecord[] memory) {
        uint256 total = allAuctions.length;
        if (offset >= total) {
            return new AuctionRecord[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 size = end - offset;
        AuctionRecord[] memory result = new AuctionRecord[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = allAuctions[offset + i];
        }

        return result;
    }

    function getTotalAuctions() external view returns (uint256) {
        return allAuctions.length;
    }
}
