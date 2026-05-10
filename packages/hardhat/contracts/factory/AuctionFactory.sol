// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "../items/AuctionItem.sol";
import "../auctions/EnglishAuction.sol";
import "../auctions/DutchAuction.sol";
import "../auctions/VickreyAuction.sol";

interface IBaseAuction {
    function winner() external view returns (address);
}

contract AuctionFactory {
    uint256 public constant MIN_AUCTION_DURATION = 10 minutes;

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
    address public immutable vickreyImpl;

    event AuctionCreated(address indexed contractAddress, AuctionType auctionType, address indexed seller);

    constructor() {
        englishImpl = address(new EnglishAuction());
        dutchImpl = address(new DutchAuction());
        vickreyImpl = address(new VickreyAuction());
    }

    function createEnglishAuction(
        AuctionItem memory item,
        uint256 reservePrice,
        uint256 duration
    ) external returns (address) {
        _validateItem(item);
        _validateDuration(duration);

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
        _validateItem(item);
        _validateDuration(duration);
        require(startPrice >= reservePrice, "Start price below reserve price");

        address clone = Clones.clone(dutchImpl);
        DutchAuction(clone).initialize(item, payable(msg.sender), startPrice, reservePrice, duration);
        _escrowItem(item, msg.sender, clone);

        _register(clone, AuctionType.Dutch, msg.sender);
        return clone;
    }

    function createVickreyAuction(
        AuctionItem memory item,
        uint256 reservePrice,
        uint256 commitDuration,
        uint256 revealDuration
    ) external returns (address) {
        _validateItem(item);
        _validateDuration(commitDuration);
        _validateDuration(revealDuration);

        address clone = Clones.clone(vickreyImpl);
        VickreyAuction(clone).initialize(item, payable(msg.sender), commitDuration, revealDuration, reservePrice);
        _escrowItem(item, msg.sender, clone);

        _register(clone, AuctionType.Vickrey, msg.sender);
        return clone;
    }

    function _validateDuration(uint256 duration) internal pure {
        require(duration >= MIN_AUCTION_DURATION, "Duration must be at least 10 minutes");
    }

    function _validateItem(AuctionItem memory item) internal pure {
        require(item.tokenContract != address(0), "Token contract cannot be zero");

        if (item.tokenType == TokenType.ERC721) {
            require(item.amount == 1, "ERC721 amount must be 1");
        } else if (item.tokenType == TokenType.ERC1155) {
            require(item.amount > 0, "ERC1155 amount must be greater than zero");
        }
    }

    function _escrowItem(AuctionItem memory item, address seller, address auctionAddress) internal {
        if (item.tokenType == TokenType.ERC721) {
            IERC721(item.tokenContract).transferFrom(seller, auctionAddress, item.tokenId);
        } else if (item.tokenType == TokenType.ERC1155) {
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

    function getAuctionsByWinner(address _winner) external view returns (AuctionRecord[] memory) {
        uint256 total = allAuctions.length;
        uint256 count = 0;

        for (uint256 i = 0; i < total; i++) {
            if (IBaseAuction(allAuctions[i].contractAddress).winner() == _winner) {
                count++;
            }
        }

        AuctionRecord[] memory result = new AuctionRecord[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < total; i++) {
            if (IBaseAuction(allAuctions[i].contractAddress).winner() == _winner) {
                result[index++] = allAuctions[i];
            }
        }

        return result;
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
