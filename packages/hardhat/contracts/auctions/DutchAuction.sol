// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../base/BaseAuction.sol";

contract DutchAuction is BaseAuction {
    uint256 public startPrice;
    uint256 public duration;
    uint256 public startTime;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        AuctionItem memory _item,
        address payable _seller,
        uint256 _startPrice,
        uint256 _reservePrice,
        uint256 _duration
    ) external initializer {
        require(_duration > 0, "Duration must be greater than zero");
        require(_startPrice >= _reservePrice, "Start price below reserve price");

        __BaseAuction_init(_item, _seller, _duration, _reservePrice);
        startPrice = _startPrice;
        duration = _duration;
        startTime = block.timestamp;
    }

    function getCurrentPrice() public view returns (uint256) {
        if (block.timestamp >= endTime) {
            return reservePrice;
        }

        uint256 elapsed = block.timestamp - startTime;
        uint256 priceDrop = (elapsed * (startPrice - reservePrice)) / duration;
        return startPrice - priceDrop;
    }

    function buy() external payable onlyActive nonReentrant {
        uint256 currentPrice = getCurrentPrice();
        require(msg.value >= currentPrice, "Bid below current price");

        // Refund excess
        if (msg.value > currentPrice) {
            (bool refundSuccess, ) = msg.sender.call{ value: msg.value - currentPrice }("");
            require(refundSuccess, "Refund failed");
        }

        // Finalize immediately
        finalized = true;

        // Transfer ETH to seller
        (bool sellerSuccess, ) = seller.call{ value: currentPrice }("");
        require(sellerSuccess, "Transfer to seller failed");

        // Transfer item to buyer
        _transferItem(msg.sender);

        emit BidPlaced(msg.sender, currentPrice);
        emit AuctionFinalized(msg.sender, currentPrice);
    }

    // Alias for buy to satisfy BaseAuction abstract bid()
    function bid() external payable override {
        revert("Use buy() for DutchAuction");
    }

    function finalize() external override onlyEnded nonReentrant {
        finalized = true;
        _transferItem(seller);
        emit AuctionCancelled();
    }
}
