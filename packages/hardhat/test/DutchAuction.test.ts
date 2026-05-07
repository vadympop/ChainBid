import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("DutchAuction", function () {
  let auction: any;
  let mockERC721: any;

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
    const factory = await FactoryFactory.deploy();

    const txCount = await ethers.provider.getTransactionCount(await factory.getAddress());
    const expectedAddress = ethers.getCreateAddress({
      from: await factory.getAddress(),
      nonce: txCount,
    });

    await mockERC721.connect(seller).approve(expectedAddress, tokenId);

    const item = {
      itemType: 0, // ERC721
      tokenContract: await mockERC721.getAddress(),
      tokenId: tokenId,
      amount: 1,
      metadataURI: "",
    };

    await factory.connect(seller).createDutchAuction(item, startPrice, reservePrice, duration);
    auction = await ethers.getContractAt("DutchAuction", expectedAddress);
  });

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
    const latestBlock = await ethers.provider.getBlock("latest");
    const nextTimestamp = latestBlock!.timestamp + 1;
    await time.setNextBlockTimestamp(nextTimestamp);

    const currentPrice = await auction.getCurrentPrice();
    const expectedPrice = currentPrice - (startPrice - reservePrice) / BigInt(duration);
    const payment = expectedPrice + ethers.parseEther("1");

    const initialBalance = await ethers.provider.getBalance(buyer.address);
    const tx = await auction.connect(buyer).buy({ value: payment });
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;

    const finalBalance = await ethers.provider.getBalance(buyer.address);
    expect(finalBalance).to.equal(initialBalance - expectedPrice - BigInt(gasUsed));
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
});
