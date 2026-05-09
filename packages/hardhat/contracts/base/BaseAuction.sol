// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "../items/AuctionItem.sol";

abstract contract BaseAuction is Initializable, ReentrancyGuard, ERC721Holder, ERC1155Holder {
    AuctionItem public item;
    address payable public seller;
    uint256 public endTime;
    bool public finalized;
    uint256 public reservePrice;
    address public winner;
    uint256 public finalPrice;
    bool public receivedConfirmed;

    mapping(address => uint256) public pendingReturns;

    event BidPlaced(address indexed bidder, uint256 amount);
    event AuctionFinalized(address indexed winner, uint256 amount);
    event AuctionCancelled();
    event ItemReturned(address indexed to);
    event ReceivedConfirmed(address indexed winner);

    modifier onlyActive() {
        require(block.timestamp < endTime, "Auction has ended");
        require(!finalized, "Auction already finalized");
        _;
    }

    modifier onlyEnded() {
        require(block.timestamp >= endTime, "Auction not yet ended");
        require(!finalized, "Auction already finalized");
        _;
    }

    modifier onlySeller() {
        require(msg.sender == seller, "Only seller can call this");
        _;
    }

    function __BaseAuction_init(
        AuctionItem memory _item,
        address payable _seller,
        uint256 _duration,
        uint256 _reservePrice
    ) internal onlyInitializing {
        item = _item;
        seller = _seller;
        endTime = block.timestamp + _duration;
        reservePrice = _reservePrice;
    }

    function _transferItem(address to) internal {
        if (item.tokenType == TokenType.ERC721) {
            IERC721(item.tokenContract).transferFrom(address(this), to, item.tokenId);
        } else if (item.tokenType == TokenType.ERC1155) {
            IERC1155(item.tokenContract).safeTransferFrom(address(this), to, item.tokenId, item.amount, "");
        }
        emit ItemReturned(to);
    }

    function _settleSale(address _winner, uint256 _finalPrice) internal {
        winner = _winner;
        finalPrice = _finalPrice;

        _transferItem(_winner);

        if (item.assetType == AssetType.Digital) {
            _releasePayment();
        }
    }

    function _releasePayment() internal {
        (bool success, ) = seller.call{ value: finalPrice }("");
        require(success, "Transfer to seller failed");
    }

    function confirmReceived() external nonReentrant {
        require(item.assetType == AssetType.Physical, "Only physical items require confirmation");
        require(finalized && winner != address(0), "Auction not sold");
        require(msg.sender == winner, "Only winner can confirm receipt");
        require(!receivedConfirmed, "Receipt already confirmed");

        receivedConfirmed = true;
        _releasePayment();

        emit ReceivedConfirmed(msg.sender);
    }

    function isAwaitingConfirmation() external view returns (bool) {
        return finalized && item.assetType == AssetType.Physical && winner != address(0) && !receivedConfirmed;
    }

    function withdraw() external nonReentrant {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "No pending returns");

        pendingReturns[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{ value: amount }("");
        require(success, "Withdrawal failed");
    }

    function bid() external payable virtual;
    function finalize() external virtual;
}
