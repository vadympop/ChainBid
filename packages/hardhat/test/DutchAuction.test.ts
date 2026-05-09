import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("DutchAuction", function () {
  let auction: any;
  let mockERC721: any;
  let factory: any;

  let seller: any;
  let buyer: any;
  let buyer2: any;

  const tokenId = 1;
  const startPrice = ethers.parseEther("10");
  const reservePrice = ethers.parseEther("2");
  const duration = 3600; // 1 hour

  beforeEach(async function () {
    [, seller, buyer, buyer2] = await ethers.getSigners();

    const ERC721Factory = await ethers.getContractFactory("MockERC721");
    mockERC721 = await ERC721Factory.deploy();

    await mockERC721.mint(seller.address, tokenId);

    const FactoryFactory = await ethers.getContractFactory("AuctionFactory");
    factory = await FactoryFactory.deploy();

    auction = await createDutchAuctionForToken(tokenId, 0);
  });

  async function createDutchAuctionForToken(auctionTokenId: number, assetType: number) {
    const txCount = await ethers.provider.getTransactionCount(await factory.getAddress());
    const expectedAddress = ethers.getCreateAddress({
      from: await factory.getAddress(),
      nonce: txCount,
    });

    await mockERC721.connect(seller).approve(await factory.getAddress(), auctionTokenId);

    const item = {
      tokenType: 0, // ERC721
      assetType,
      tokenContract: await mockERC721.getAddress(),
      tokenId: auctionTokenId,
      amount: 1,
      metadataURI: "",
    };

    await factory.connect(seller).createDutchAuction(item, startPrice, reservePrice, duration);
    return ethers.getContractAt("DutchAuction", expectedAddress);
  }

  async function getNextBlockPrice(dutchAuction: any) {
    const latestBlock = await ethers.provider.getBlock("latest");
    const nextTimestamp = latestBlock!.timestamp + 1;
    await time.setNextBlockTimestamp(nextTimestamp);

    const currentPrice = await dutchAuction.getCurrentPrice();
    return currentPrice - (startPrice - reservePrice) / BigInt(duration);
  }

  it("getCurrentPrice() returns correct value at t=0, t=half, t=end", async function () {
    expect(await auction.getCurrentPrice()).to.equal(startPrice);

    await time.increase(duration / 2);
    // Price should be startPrice - (half of drop)
    const expectedHalfPrice = startPrice - (startPrice - reservePrice) / 2n;
    // It might be slightly off due to timestamp rounding, but hardhat network helpers sets exact block times
    expect(await auction.getCurrentPrice()).to.equal(expectedHalfPrice);

    await time.increase(duration / 2);
    expect(await auction.getCurrentPrice()).to.equal(reservePrice);
  });

  it("Buy below current price reverts", async function () {
    await expect(auction.connect(buyer).buy({ value: ethers.parseEther("1") })).to.be.revertedWith(
      "Bid below current price",
    );
  });

  it("Excess ETH refunded correctly", async function () {
    const expectedPrice = await getNextBlockPrice(auction);
    const payment = expectedPrice + ethers.parseEther("1");

    const initialBalance = await ethers.provider.getBalance(buyer.address);
    const tx = await auction.connect(buyer).buy({ value: payment });
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;

    const finalBalance = await ethers.provider.getBalance(buyer.address);
    expect(finalBalance).to.equal(initialBalance - expectedPrice - BigInt(gasUsed));
  });

  it("buy() for digital item sends ETH to seller immediately", async function () {
    const expectedPrice = await getNextBlockPrice(auction);
    const initialBalance = await ethers.provider.getBalance(seller.address);

    await auction.connect(buyer).buy({ value: expectedPrice });

    const finalBalance = await ethers.provider.getBalance(seller.address);
    expect(finalBalance - initialBalance).to.equal(expectedPrice);
    expect(await mockERC721.ownerOf(tokenId)).to.equal(buyer.address);
    expect(await auction.winner()).to.equal(buyer.address);
    expect(await auction.finalPrice()).to.equal(expectedPrice);
    expect(await auction.isAwaitingConfirmation()).to.equal(false);
  });

  it("getAuctionInfo() returns Dutch auction and settlement details", async function () {
    const expectedPrice = await getNextBlockPrice(auction);
    await auction.connect(buyer).buy({ value: expectedPrice });

    const auctionInfo = await auction.getAuctionInfo();

    expect(auctionInfo.item.tokenType).to.equal(0n);
    expect(auctionInfo.item.assetType).to.equal(0n);
    expect(auctionInfo.seller).to.equal(seller.address);
    expect(auctionInfo.finalized).to.equal(true);
    expect(auctionInfo.reservePrice).to.equal(reservePrice);
    expect(auctionInfo.startPrice).to.equal(startPrice);
    expect(auctionInfo.duration).to.equal(BigInt(duration));
    expect(auctionInfo.currentPrice).to.equal(expectedPrice);
    expect(auctionInfo.winner).to.equal(buyer.address);
    expect(auctionInfo.finalPrice).to.equal(expectedPrice);
    expect(auctionInfo.receivedConfirmed).to.equal(false);
  });

  it("buy() for physical item holds ETH until winner confirms receipt", async function () {
    const physicalTokenId = 2;
    await mockERC721.mint(seller.address, physicalTokenId);
    const physicalAuction = await createDutchAuctionForToken(physicalTokenId, 1);
    const expectedPrice = await getNextBlockPrice(physicalAuction);

    const initialBalance = await ethers.provider.getBalance(seller.address);
    await physicalAuction.connect(buyer).buy({ value: expectedPrice });
    const afterBuyBalance = await ethers.provider.getBalance(seller.address);

    expect(afterBuyBalance).to.equal(initialBalance);
    expect(await ethers.provider.getBalance(await physicalAuction.getAddress())).to.equal(expectedPrice);
    expect(await mockERC721.ownerOf(physicalTokenId)).to.equal(buyer.address);
    expect(await physicalAuction.winner()).to.equal(buyer.address);
    expect(await physicalAuction.finalPrice()).to.equal(expectedPrice);
    expect(await physicalAuction.isAwaitingConfirmation()).to.equal(true);

    await physicalAuction.connect(buyer).confirmReceived();
    const finalBalance = await ethers.provider.getBalance(seller.address);

    expect(finalBalance - initialBalance).to.equal(expectedPrice);
    expect(await ethers.provider.getBalance(await physicalAuction.getAddress())).to.equal(0n);
    expect(await physicalAuction.receivedConfirmed()).to.equal(true);
    expect(await physicalAuction.isAwaitingConfirmation()).to.equal(false);
  });

  it("Second buyer after first wins reverts", async function () {
    const currentPrice = await auction.getCurrentPrice();
    await auction.connect(buyer).buy({ value: currentPrice });

    await expect(auction.connect(buyer2).buy({ value: currentPrice })).to.be.revertedWith("Auction already finalized");
  });

  it("Price never goes below reservePrice", async function () {
    await time.increase(duration * 2);
    expect(await auction.getCurrentPrice()).to.equal(reservePrice);
  });

  it("createDutchAuction() reverts when start price is below reserve price", async function () {
    const FactoryFactory = await ethers.getContractFactory("AuctionFactory");
    const factory = await FactoryFactory.deploy();

    const invalidTokenId = 2;
    await mockERC721.mint(seller.address, invalidTokenId);

    await mockERC721.connect(seller).approve(await factory.getAddress(), invalidTokenId);

    const item = {
      tokenType: 0,
      assetType: 0,
      tokenContract: await mockERC721.getAddress(),
      tokenId: invalidTokenId,
      amount: 1,
      metadataURI: "",
    };

    await expect(
      factory.connect(seller).createDutchAuction(item, ethers.parseEther("1"), ethers.parseEther("2"), duration),
    ).to.be.revertedWith("Start price below reserve price");
  });

  it("createDutchAuction() reverts when duration is zero", async function () {
    const FactoryFactory = await ethers.getContractFactory("AuctionFactory");
    const factory = await FactoryFactory.deploy();

    const invalidTokenId = 3;
    await mockERC721.mint(seller.address, invalidTokenId);

    await mockERC721.connect(seller).approve(await factory.getAddress(), invalidTokenId);

    const item = {
      tokenType: 0,
      assetType: 0,
      tokenContract: await mockERC721.getAddress(),
      tokenId: invalidTokenId,
      amount: 1,
      metadataURI: "",
    };

    await expect(factory.connect(seller).createDutchAuction(item, startPrice, reservePrice, 0)).to.be.revertedWith(
      "Duration must be greater than zero",
    );
  });
});
