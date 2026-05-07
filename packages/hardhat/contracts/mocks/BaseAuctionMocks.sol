// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../base/BaseAuction.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockBaseAuction is BaseAuction {
    constructor() {}

    function initialize(
        AuctionItem memory _item,
        address payable _seller,
        uint256 _duration,
        uint256 _reservePrice
    ) external initializer {
        __BaseAuction_init(_item, _seller, _duration, _reservePrice);
    }

    function bid() external payable override {}
    function finalize() external override {}

    // Expose internal functions for testing
    function transferItem(address to) external {
        _transferItem(to);
    }

    function setPendingReturn(address user, uint256 amount) external {
        pendingReturns[user] = amount;
    }

    // Helper to receive ETH
    receive() external payable {}
}

contract MockERC721 is ERC721 {
    constructor() ERC721("Mock", "MCK") {}
    
    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}

contract WithdrawAttacker {
    MockBaseAuction public auction;
    uint256 public count;

    constructor(address _auction) {
        auction = MockBaseAuction(payable(_auction));
    }

    receive() external payable {
        if (count < 2) {
            count++;
            auction.withdraw();
        }
    }

    function attack() external {
        auction.withdraw();
    }
}
