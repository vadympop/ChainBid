// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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

    event AuctionCreated(address indexed contractAddress, AuctionType auctionType, address indexed seller);

    function createEnglishAuction(
        AuctionItem memory item,
        uint256 reservePrice,
        uint256 duration
    ) external returns (address) {
        EnglishAuction newAuction = new EnglishAuction(
            item,
            payable(msg.sender),
            duration,
            reservePrice
        );

        _register(address(newAuction), AuctionType.English, msg.sender);
        return address(newAuction);
    }

    function createDutchAuction(
        AuctionItem memory item,
        uint256 startPrice,
        uint256 reservePrice,
        uint256 duration
    ) external returns (address) {
        DutchAuction newAuction = new DutchAuction(
            item,
            payable(msg.sender),
            startPrice,
            reservePrice,
            duration
        );

        _register(address(newAuction), AuctionType.Dutch, msg.sender);
        return address(newAuction);
    }

    function _register(address auctionAddress, AuctionType auctionType, address seller) internal {
        allAuctions.push(AuctionRecord({
            contractAddress: auctionAddress,
            auctionType: auctionType,
            seller: seller,
            createdAt: block.timestamp
        }));
        
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
