// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../base/BaseAuction.sol";

contract EnglishAuction is BaseAuction {
    address public highestBidder;
    uint256 public highestBid;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        AuctionItem memory _item,
        address payable _seller,
        uint256 _duration,
        uint256 _reservePrice
    ) external initializer {
        __BaseAuction_init(_item, _seller, _duration, _reservePrice);
    }

    function bid() external payable override onlyActive nonReentrant {
        require(msg.sender != seller, "Seller cannot bid");
        require(msg.value >= reservePrice, "Bid below reserve price");
        require(msg.value > highestBid, "Bid must be higher than current highest bid");

        if (highestBidder != address(0)) {
            pendingReturns[highestBidder] += highestBid;
        }

        highestBidder = msg.sender;
        highestBid = msg.value;

        // Anti-sniping
        if (endTime - block.timestamp < 5 minutes) {
            endTime += 5 minutes;
        }

        emit BidPlaced(msg.sender, msg.value);
    }

    function finalize() external override onlyEnded nonReentrant {
        finalized = true;

        if (highestBidder != address(0)) {
            _settleSale(highestBidder, highestBid);
            emit AuctionFinalized(highestBidder, highestBid);
        } else {
            // No bids, return item to seller
            _transferItem(seller);
            emit AuctionCancelled();
        }
    }

    struct AuctionInfo {
        AuctionItem item;
        address seller;
        uint256 endTime;
        bool finalized;
        uint256 reservePrice;
        address highestBidder;
        uint256 highestBid;
        address winner;
        uint256 finalPrice;
        bool receivedConfirmed;
    }

    function getAuctionInfo() external view returns (AuctionInfo memory) {
        return
            AuctionInfo({
                item: item,
                seller: seller,
                endTime: endTime,
                finalized: finalized,
                reservePrice: reservePrice,
                highestBidder: highestBidder,
                highestBid: highestBid,
                winner: winner,
                finalPrice: finalPrice,
                receivedConfirmed: receivedConfirmed
            });
    }
}
