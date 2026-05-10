// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../base/BaseAuction.sol";

contract VickreyAuction is BaseAuction {
    struct BidCommitment {
        bytes32 commitment;
        uint256 deposit;
        bool revealed;
        bool valid;
        uint256 bidAmount;
    }

    uint256 public commitEndTime;
    address public highestBidder;
    uint256 public highestBid;
    uint256 public secondHighestBid;
    uint256 public validBidCount;

    address[] private bidders;

    mapping(address bidder => BidCommitment) public commitments;
    mapping(address bidder => bool) public blocked;

    event BidCommitted(address indexed bidder, bytes32 indexed commitment, uint256 deposit);
    event BidRevealed(address indexed bidder, uint256 bidAmount);
    event BidInvalidated(address indexed bidder, uint256 refund);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        AuctionItem memory _item,
        address payable _seller,
        uint256 _commitDuration,
        uint256 _revealDuration,
        uint256 _reservePrice
    ) external initializer {
        require(_commitDuration > 0, "Commit duration must be greater than zero");
        require(_revealDuration > 0, "Reveal duration must be greater than zero");

        __BaseAuction_init(_item, _seller, _commitDuration + _revealDuration, _reservePrice);
        commitEndTime = block.timestamp + _commitDuration;
    }

    function revealEndTime() external view returns (uint256) {
        return endTime;
    }

    function getBidderCount() external view returns (uint256) {
        return bidders.length;
    }

    function commit(bytes32 commitment) external payable onlyActive nonReentrant {
        require(block.timestamp < commitEndTime, "Commit phase has ended");
        require(msg.sender != seller, "Seller cannot bid");
        require(commitment != bytes32(0), "Commitment cannot be empty");
        require(msg.value > 0, "Deposit must be greater than zero");
        require(commitments[msg.sender].commitment == bytes32(0), "Bid already committed");
        require(!blocked[msg.sender], "Bidder is blocked");

        commitments[msg.sender] = BidCommitment({
            commitment: commitment,
            deposit: msg.value,
            revealed: false,
            valid: false,
            bidAmount: 0
        });
        bidders.push(msg.sender);

        emit BidCommitted(msg.sender, commitment, msg.value);
    }

    function reveal(uint256 bidAmount, bytes32 secret) external nonReentrant {
        require(block.timestamp >= commitEndTime, "Reveal phase has not started");
        require(block.timestamp < endTime, "Reveal phase has ended");

        BidCommitment storage bidderCommitment = commitments[msg.sender];
        require(bidderCommitment.commitment != bytes32(0), "No bid committed");
        require(!bidderCommitment.revealed, "Bid already revealed");
        require(!blocked[msg.sender], "Bidder is blocked");

        bytes32 expectedCommitment = keccak256(abi.encode(bidAmount, secret));
        if (expectedCommitment != bidderCommitment.commitment || bidderCommitment.deposit < bidAmount) {
            _invalidateBid(msg.sender, bidderCommitment);
            return;
        }

        bidderCommitment.revealed = true;
        bidderCommitment.valid = true;
        bidderCommitment.bidAmount = bidAmount;
        validBidCount++;

        if (bidAmount > highestBid) {
            secondHighestBid = highestBid;
            highestBid = bidAmount;
            highestBidder = msg.sender;
        } else if (bidAmount > secondHighestBid) {
            secondHighestBid = bidAmount;
        }

        emit BidPlaced(msg.sender, bidAmount);
        emit BidRevealed(msg.sender, bidAmount);
    }

    function bid() external payable override {
        revert("Use commit() for VickreyAuction");
    }

    function finalize() external override onlyEnded nonReentrant {
        finalized = true;

        if (highestBidder == address(0) || highestBid < reservePrice) {
            _queueAllRefunds(address(0), 0);
            _transferItem(seller);
            emit AuctionCancelled();
            return;
        }

        uint256 price = secondHighestBid > reservePrice ? secondHighestBid : reservePrice;
        _queueAllRefunds(highestBidder, price);
        _settleSale(highestBidder, price);

        emit AuctionFinalized(highestBidder, price);
    }

    function _invalidateBid(address bidder, BidCommitment storage bidderCommitment) internal {
        uint256 refund = bidderCommitment.deposit;

        bidderCommitment.deposit = 0;
        bidderCommitment.revealed = true;
        blocked[bidder] = true;

        (bool success, ) = payable(bidder).call{ value: refund }("");
        require(success, "Refund failed");

        emit BidInvalidated(bidder, refund);
    }

    function _queueAllRefunds(address saleWinner, uint256 salePrice) internal {
        for (uint256 i = 0; i < bidders.length; i++) {
            address bidder = bidders[i];
            BidCommitment storage bidderCommitment = commitments[bidder];
            uint256 deposit = bidderCommitment.deposit;

            if (deposit == 0) {
                continue;
            }

            bidderCommitment.deposit = 0;

            if (bidder == saleWinner) {
                if (deposit > salePrice) {
                    pendingReturns[bidder] += deposit - salePrice;
                }
            } else {
                pendingReturns[bidder] += deposit;
            }
        }
    }

    struct AuctionInfo {
        AuctionItem item;
        address seller;
        uint256 commitEndTime;
        uint256 revealEndTime;
        bool finalized;
        uint256 reservePrice;
        address highestBidder;
        uint256 highestBid;
        uint256 secondHighestBid;
        uint256 validBidCount;
        uint256 totalCommitments;
        address winner;
        uint256 finalPrice;
        bool receivedConfirmed;
    }

    function getAuctionInfo() external view returns (AuctionInfo memory) {
        return
            AuctionInfo({
                item: item,
                seller: seller,
                commitEndTime: commitEndTime,
                revealEndTime: endTime,
                finalized: finalized,
                reservePrice: reservePrice,
                highestBidder: highestBidder,
                highestBid: highestBid,
                secondHighestBid: secondHighestBid,
                validBidCount: validBidCount,
                totalCommitments: bidders.length,
                winner: winner,
                finalPrice: finalPrice,
                receivedConfirmed: receivedConfirmed
            });
    }
}
