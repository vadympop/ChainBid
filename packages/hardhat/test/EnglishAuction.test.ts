import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("EnglishAuction", function () {
  let auction: any;
  let mockERC721: any;
  let factory: any;

  let seller: any;
  let bidder1: any;
  let bidder2: any;

  const tokenId = 1;
  const reservePrice = ethers.parseEther("1");
  const duration = 3600; // 1 hour

  beforeEach(async function () {
    [, seller, bidder1, bidder2] = await ethers.getSigners();

    const ERC721Factory = await ethers.getContractFactory("MockERC721");
    mockERC721 = await ERC721Factory.deploy();

    await mockERC721.mint(seller.address, tokenId);

    const FactoryFactory = await ethers.getContractFactory("AuctionFactory");
    factory = await FactoryFactory.deploy();

    auction = await createEnglishAuctionForToken(tokenId, 0);
  });

  async function createEnglishAuctionForToken(auctionTokenId: number, assetType: number) {
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

    await factory.connect(seller).createEnglishAuction(item, reservePrice, duration);
    return ethers.getContractAt("EnglishAuction", expectedAddress);
  }

  it("Bid below highest reverts", async function () {
    await auction.connect(bidder1).bid({ value: ethers.parseEther("2") });
    await expect(auction.connect(bidder2).bid({ value: ethers.parseEther("1.5") })).to.be.revertedWith(
      "Bid must be higher than current highest bid",
    );
  });

  it("Bid below reserve price reverts", async function () {
    await expect(auction.connect(bidder1).bid({ value: ethers.parseEther("0.5") })).to.be.revertedWith(
      "Bid below reserve price",
    );
  });

  it("Bid after endTime reverts", async function () {
    await time.increase(duration + 1);
    await expect(auction.connect(bidder1).bid({ value: ethers.parseEther("2") })).to.be.revertedWith(
      "Auction has ended",
    );
  });

  it("Outbid queues correct refund for previous bidder", async function () {
    await auction.connect(bidder1).bid({ value: ethers.parseEther("1.5") });
    await auction.connect(bidder2).bid({ value: ethers.parseEther("2") });
    expect(await auction.pendingReturns(bidder1.address)).to.equal(ethers.parseEther("1.5"));
  });

  it("Multiple bidders — only highest wins", async function () {
    await auction.connect(bidder1).bid({ value: ethers.parseEther("1.5") });
    await auction.connect(bidder2).bid({ value: ethers.parseEther("2") });
    await auction.connect(bidder1).bid({ value: ethers.parseEther("2.5") });

    expect(await auction.highestBidder()).to.equal(bidder1.address);
    expect(await auction.highestBid()).to.equal(ethers.parseEther("2.5"));
  });

  it("Anti-sniping extends time correctly", async function () {
    const initialEndTime = await auction.endTime();
    // Move time to 4 minutes before end
    await time.increase(duration - 240);

    await auction.connect(bidder1).bid({ value: ethers.parseEther("2") });

    const newEndTime = await auction.endTime();
    expect(newEndTime).to.equal(initialEndTime + 300n);
  });

  it("Bid outside anti-sniping window does not extend time", async function () {
    const initialEndTime = await auction.endTime();

    await auction.connect(bidder1).bid({ value: ethers.parseEther("2") });

    expect(await auction.endTime()).to.equal(initialEndTime);
  });

  it("finalize() before end reverts", async function () {
    await expect(auction.finalize()).to.be.revertedWith("Auction not yet ended");
  });

  it("finalize() with no bids returns NFT to seller", async function () {
    await time.increase(duration + 1);
    await auction.finalize();
    expect(await mockERC721.ownerOf(tokenId)).to.equal(seller.address);
  });

  it("finalize() with bids sends ETH to seller, NFT to winner", async function () {
    await auction.connect(bidder1).bid({ value: ethers.parseEther("2") });
    await time.increase(duration + 1);

    const initialBalance = await ethers.provider.getBalance(seller.address);
    await auction.finalize();
    const finalBalance = await ethers.provider.getBalance(seller.address);

    expect(finalBalance - initialBalance).to.equal(ethers.parseEther("2"));
    expect(await mockERC721.ownerOf(tokenId)).to.equal(bidder1.address);
  });

  it("finalize() with physical item holds ETH until winner confirms receipt", async function () {
    const physicalTokenId = 2;
    const price = ethers.parseEther("2");
    await mockERC721.mint(seller.address, physicalTokenId);
    const physicalAuction = await createEnglishAuctionForToken(physicalTokenId, 1);

    await physicalAuction.connect(bidder1).bid({ value: price });
    await time.increase(duration + 1);

    const initialBalance = await ethers.provider.getBalance(seller.address);
    await physicalAuction.finalize();
    const afterFinalizeBalance = await ethers.provider.getBalance(seller.address);

    expect(afterFinalizeBalance).to.equal(initialBalance);
    expect(await ethers.provider.getBalance(await physicalAuction.getAddress())).to.equal(price);
    expect(await mockERC721.ownerOf(physicalTokenId)).to.equal(bidder1.address);
    expect(await physicalAuction.winner()).to.equal(bidder1.address);
    expect(await physicalAuction.finalPrice()).to.equal(price);
    expect(await physicalAuction.isAwaitingConfirmation()).to.equal(true);

    await physicalAuction.connect(bidder1).confirmReceived();
    const finalBalance = await ethers.provider.getBalance(seller.address);

    expect(finalBalance - initialBalance).to.equal(price);
    expect(await ethers.provider.getBalance(await physicalAuction.getAddress())).to.equal(0n);
    expect(await physicalAuction.receivedConfirmed()).to.equal(true);
    expect(await physicalAuction.isAwaitingConfirmation()).to.equal(false);
  });

  it("confirmReceived() rejects non-winner, digital auctions, and repeated confirmation", async function () {
    await auction.connect(bidder1).bid({ value: ethers.parseEther("2") });
    await time.increase(duration + 1);
    await auction.finalize();

    await expect(auction.connect(bidder1).confirmReceived()).to.be.revertedWith(
      "Only physical items require confirmation",
    );

    const physicalTokenId = 3;
    await mockERC721.mint(seller.address, physicalTokenId);
    const physicalAuction = await createEnglishAuctionForToken(physicalTokenId, 1);
    await physicalAuction.connect(bidder1).bid({ value: ethers.parseEther("2") });
    await time.increase(duration + 1);
    await physicalAuction.finalize();

    await expect(physicalAuction.connect(bidder2).confirmReceived()).to.be.revertedWith(
      "Only winner can confirm receipt",
    );

    await physicalAuction.connect(bidder1).confirmReceived();
    await expect(physicalAuction.connect(bidder1).confirmReceived()).to.be.revertedWith("Receipt already confirmed");
  });

  it("confirmReceived() reverts before a physical auction is sold", async function () {
    const physicalTokenId = 4;
    await mockERC721.mint(seller.address, physicalTokenId);
    const physicalAuction = await createEnglishAuctionForToken(physicalTokenId, 1);

    await expect(physicalAuction.connect(bidder1).confirmReceived()).to.be.revertedWith("Auction not sold");
  });

  it("Double finalize() reverts", async function () {
    await time.increase(duration + 1);
    await auction.finalize();
    await expect(auction.finalize()).to.be.revertedWith("Auction already finalized");
  });

  it("Seller cannot bid on own auction", async function () {
    await expect(auction.connect(seller).bid({ value: ethers.parseEther("2") })).to.be.revertedWith(
      "Seller cannot bid",
    );
  });
});
