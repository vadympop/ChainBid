import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("VickreyAuction", function () {
  let auction: any;
  let mockERC721: any;
  let factory: any;

  let seller: any;
  let bidder1: any;
  let bidder2: any;
  let bidder3: any;

  const tokenId = 1;
  const reservePrice = ethers.parseEther("1");
  const commitDuration = 600;
  const revealDuration = 600;
  const coder = ethers.AbiCoder.defaultAbiCoder();

  beforeEach(async function () {
    [, seller, bidder1, bidder2, bidder3] = await ethers.getSigners();

    const ERC721Factory = await ethers.getContractFactory("MockERC721");
    mockERC721 = await ERC721Factory.deploy();

    await mockERC721.mint(seller.address, tokenId);

    const FactoryFactory = await ethers.getContractFactory("AuctionFactory");
    factory = await FactoryFactory.deploy();

    auction = await createVickreyAuctionForToken(tokenId, 0, reservePrice);
  });

  async function createVickreyAuctionForToken(auctionTokenId: number, assetType: number, reserve: bigint) {
    const txCount = await ethers.provider.getTransactionCount(await factory.getAddress());
    const expectedAddress = ethers.getCreateAddress({
      from: await factory.getAddress(),
      nonce: txCount,
    });

    await mockERC721.connect(seller).approve(await factory.getAddress(), auctionTokenId);

    const item = {
      tokenType: 0,
      assetType,
      tokenContract: await mockERC721.getAddress(),
      tokenId: auctionTokenId,
      amount: 1,
      metadataURI: "",
    };

    await factory.connect(seller).createVickreyAuction(item, reserve, commitDuration, revealDuration);
    return ethers.getContractAt("VickreyAuction", expectedAddress);
  }

  function commitmentFor(bidAmount: bigint, secret: string) {
    return ethers.keccak256(coder.encode(["uint256", "bytes32"], [bidAmount, secret]));
  }

  async function moveToRevealPhase() {
    await time.increase(commitDuration + 1);
  }

  async function movePastRevealPhase() {
    await time.increase(commitDuration + revealDuration + 1);
  }

  it("commit() stores only the hash and deposit during the commit phase", async function () {
    const bidAmount = ethers.parseEther("2");
    const secret = ethers.id("bidder1");
    const commitment = commitmentFor(bidAmount, secret);

    await auction.connect(bidder1).commit(commitment, { value: ethers.parseEther("3") });

    const stored = await auction.commitments(bidder1.address);
    expect(stored.commitment).to.equal(commitment);
    expect(stored.deposit).to.equal(ethers.parseEther("3"));
    expect(stored.revealed).to.equal(false);
    expect(await auction.getBidderCount()).to.equal(1n);
    expect(await ethers.provider.getBalance(await auction.getAddress())).to.equal(ethers.parseEther("3"));
  });

  it("view helpers expose reveal end time and auction info", async function () {
    const bidAmount = ethers.parseEther("2");
    const secret = ethers.id("bidder1");
    await auction.connect(bidder1).commit(commitmentFor(bidAmount, secret), { value: bidAmount });

    const auctionInfo = await auction.getAuctionInfo();

    expect(await auction.revealEndTime()).to.equal(await auction.endTime());
    expect(auctionInfo.item.tokenType).to.equal(0n);
    expect(auctionInfo.seller).to.equal(seller.address);
    expect(auctionInfo.commitEndTime).to.equal(await auction.commitEndTime());
    expect(auctionInfo.revealEndTime).to.equal(await auction.endTime());
    expect(auctionInfo.finalized).to.equal(false);
    expect(auctionInfo.reservePrice).to.equal(reservePrice);
    expect(auctionInfo.totalCommitments).to.equal(1n);
    expect(auctionInfo.winner).to.equal(ethers.ZeroAddress);
    expect(auctionInfo.receivedConfirmed).to.equal(false);
  });

  it("commit() rejects seller, duplicate bids, zero deposit, and late commits", async function () {
    const commitment = commitmentFor(ethers.parseEther("2"), ethers.id("bidder1"));

    await expect(auction.connect(seller).commit(commitment, { value: ethers.parseEther("2") })).to.be.revertedWith(
      "Seller cannot bid",
    );
    await expect(auction.connect(bidder1).commit(commitment)).to.be.revertedWith("Deposit must be greater than zero");
    await expect(
      auction.connect(bidder1).commit(ethers.ZeroHash, { value: ethers.parseEther("2") }),
    ).to.be.revertedWith("Commitment cannot be empty");

    await auction.connect(bidder1).commit(commitment, { value: ethers.parseEther("2") });
    await expect(auction.connect(bidder1).commit(commitment, { value: ethers.parseEther("2") })).to.be.revertedWith(
      "Bid already committed",
    );

    await moveToRevealPhase();
    await expect(auction.connect(bidder2).commit(commitment, { value: ethers.parseEther("2") })).to.be.revertedWith(
      "Commit phase has ended",
    );
  });

  it("reveal() validates the hash and records highest and second-highest bids", async function () {
    const bid1 = ethers.parseEther("5");
    const bid2 = ethers.parseEther("3");
    const secret1 = ethers.id("bidder1");
    const secret2 = ethers.id("bidder2");

    await auction.connect(bidder1).commit(commitmentFor(bid1, secret1), { value: ethers.parseEther("6") });
    await auction.connect(bidder2).commit(commitmentFor(bid2, secret2), { value: ethers.parseEther("4") });
    await moveToRevealPhase();

    await auction.connect(bidder2).reveal(bid2, secret2);
    await auction.connect(bidder1).reveal(bid1, secret1);

    expect(await auction.highestBidder()).to.equal(bidder1.address);
    expect(await auction.highestBid()).to.equal(bid1);
    expect(await auction.secondHighestBid()).to.equal(bid2);
    expect(await auction.validBidCount()).to.equal(2n);
  });

  it("reveal() keeps second-highest bid when a lower bid is revealed later", async function () {
    const bid1 = ethers.parseEther("5");
    const bid2 = ethers.parseEther("3");
    const bid3 = ethers.parseEther("2");
    const secret1 = ethers.id("bidder1");
    const secret2 = ethers.id("bidder2");
    const secret3 = ethers.id("bidder3");

    await auction.connect(bidder1).commit(commitmentFor(bid1, secret1), { value: bid1 });
    await auction.connect(bidder2).commit(commitmentFor(bid2, secret2), { value: bid2 });
    await auction.connect(bidder3).commit(commitmentFor(bid3, secret3), { value: bid3 });
    await moveToRevealPhase();

    await auction.connect(bidder1).reveal(bid1, secret1);
    await auction.connect(bidder2).reveal(bid2, secret2);
    await auction.connect(bidder3).reveal(bid3, secret3);

    expect(await auction.highestBid()).to.equal(bid1);
    expect(await auction.secondHighestBid()).to.equal(bid2);
  });

  it("reveal() rejects missing and duplicate reveals", async function () {
    const bidAmount = ethers.parseEther("2");
    const secret = ethers.id("bidder1");

    await auction.connect(bidder1).commit(commitmentFor(bidAmount, secret), { value: bidAmount });
    await moveToRevealPhase();

    await expect(auction.connect(bidder2).reveal(bidAmount, secret)).to.be.revertedWith("No bid committed");

    await auction.connect(bidder1).reveal(bidAmount, secret);
    await expect(auction.connect(bidder1).reveal(bidAmount, secret)).to.be.revertedWith("Bid already revealed");
  });

  it("reveal() blocks and immediately refunds a bidder with the wrong secret", async function () {
    const bidAmount = ethers.parseEther("2");
    const deposit = ethers.parseEther("3");

    await auction.connect(bidder1).commit(commitmentFor(bidAmount, ethers.id("correct")), { value: deposit });
    await moveToRevealPhase();

    await expect(() => auction.connect(bidder1).reveal(bidAmount, ethers.id("wrong"))).to.changeEtherBalances(
      [await auction.getAddress(), bidder1],
      [-deposit, deposit],
    );

    expect(await auction.blocked(bidder1.address)).to.equal(true);
    expect((await auction.commitments(bidder1.address)).deposit).to.equal(0n);
  });

  it("reveal() reverts when invalid bid refund fails", async function () {
    const RejectorFactory = await ethers.getContractFactory("RefundRejector");
    const refundRejector = await RejectorFactory.deploy();
    const bidAmount = ethers.parseEther("2");
    const deposit = ethers.parseEther("3");

    await refundRejector.commitVickrey(await auction.getAddress(), commitmentFor(bidAmount, ethers.id("correct")), {
      value: deposit,
    });
    await moveToRevealPhase();

    await expect(
      refundRejector.revealVickrey(await auction.getAddress(), bidAmount, ethers.id("wrong")),
    ).to.be.revertedWith("Refund failed");
  });

  it("reveal() blocks and refunds when deposit is below the revealed bid", async function () {
    const bidAmount = ethers.parseEther("5");
    const deposit = ethers.parseEther("4");
    const secret = ethers.id("bidder1");

    await auction.connect(bidder1).commit(commitmentFor(bidAmount, secret), { value: deposit });
    await moveToRevealPhase();

    await expect(() => auction.connect(bidder1).reveal(bidAmount, secret)).to.changeEtherBalances(
      [await auction.getAddress(), bidder1],
      [-deposit, deposit],
    );

    expect(await auction.blocked(bidder1.address)).to.equal(true);
    expect(await auction.validBidCount()).to.equal(0n);
  });

  it("finalize() awards the item to the highest bidder at the second-highest bid", async function () {
    const bid1 = ethers.parseEther("5");
    const bid2 = ethers.parseEther("3");
    const secret1 = ethers.id("bidder1");
    const secret2 = ethers.id("bidder2");

    await auction.connect(bidder1).commit(commitmentFor(bid1, secret1), { value: ethers.parseEther("6") });
    await auction.connect(bidder2).commit(commitmentFor(bid2, secret2), { value: ethers.parseEther("4") });
    await moveToRevealPhase();
    await auction.connect(bidder1).reveal(bid1, secret1);
    await auction.connect(bidder2).reveal(bid2, secret2);
    await time.increase(revealDuration + 1);

    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
    await auction.finalize();
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);

    expect(await mockERC721.ownerOf(tokenId)).to.equal(bidder1.address);
    expect(await auction.winner()).to.equal(bidder1.address);
    expect(await auction.finalPrice()).to.equal(bid2);
    expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(bid2);
    expect(await auction.pendingReturns(bidder1.address)).to.equal(ethers.parseEther("3"));
    expect(await auction.pendingReturns(bidder2.address)).to.equal(ethers.parseEther("4"));
  });

  it("finalize() charges the reserve price when there is only one valid bidder", async function () {
    const bidAmount = ethers.parseEther("5");
    const secret = ethers.id("bidder1");

    await auction.connect(bidder1).commit(commitmentFor(bidAmount, secret), { value: ethers.parseEther("6") });
    await moveToRevealPhase();
    await auction.connect(bidder1).reveal(bidAmount, secret);
    await time.increase(revealDuration + 1);

    await auction.finalize();

    expect(await auction.winner()).to.equal(bidder1.address);
    expect(await auction.finalPrice()).to.equal(reservePrice);
    expect(await auction.pendingReturns(bidder1.address)).to.equal(ethers.parseEther("5"));
  });

  it("finalize() returns the item and queues refunds when reserve is not met", async function () {
    const bidAmount = ethers.parseEther("0.5");
    const secret = ethers.id("bidder1");

    await auction.connect(bidder1).commit(commitmentFor(bidAmount, secret), { value: ethers.parseEther("1") });
    await moveToRevealPhase();
    await auction.connect(bidder1).reveal(bidAmount, secret);
    await time.increase(revealDuration + 1);

    await auction.finalize();

    expect(await mockERC721.ownerOf(tokenId)).to.equal(seller.address);
    expect(await auction.winner()).to.equal(ethers.ZeroAddress);
    expect(await auction.pendingReturns(bidder1.address)).to.equal(ethers.parseEther("1"));
  });

  it("finalize() refunds unrevealed deposits through pending returns", async function () {
    const bid1 = ethers.parseEther("5");
    const bid2 = ethers.parseEther("3");
    const secret1 = ethers.id("bidder1");
    const secret2 = ethers.id("bidder2");

    await auction.connect(bidder1).commit(commitmentFor(bid1, secret1), { value: ethers.parseEther("6") });
    await auction.connect(bidder2).commit(commitmentFor(bid2, secret2), { value: ethers.parseEther("4") });
    await moveToRevealPhase();
    await auction.connect(bidder1).reveal(bid1, secret1);
    await time.increase(revealDuration + 1);

    await auction.finalize();

    expect(await auction.finalPrice()).to.equal(reservePrice);
    expect(await auction.pendingReturns(bidder1.address)).to.equal(ethers.parseEther("5"));
    expect(await auction.pendingReturns(bidder2.address)).to.equal(ethers.parseEther("4"));
  });

  it("finalize() skips invalidated deposits and keeps exact-price winner refund at zero", async function () {
    const winningBid = ethers.parseEther("3");
    const secondBid = ethers.parseEther("3");
    const invalidBid = ethers.parseEther("2");
    const secret1 = ethers.id("bidder1");
    const secret2 = ethers.id("bidder2");

    await auction.connect(bidder1).commit(commitmentFor(winningBid, secret1), { value: winningBid });
    await auction.connect(bidder2).commit(commitmentFor(secondBid, secret2), { value: secondBid });
    await auction.connect(bidder3).commit(commitmentFor(invalidBid, ethers.id("correct")), { value: invalidBid });
    await moveToRevealPhase();

    await auction.connect(bidder1).reveal(winningBid, secret1);
    await auction.connect(bidder2).reveal(secondBid, secret2);
    await auction.connect(bidder3).reveal(invalidBid, ethers.id("wrong"));
    await time.increase(revealDuration + 1);

    await auction.finalize();

    expect(await auction.finalPrice()).to.equal(secondBid);
    expect(await auction.pendingReturns(bidder1.address)).to.equal(0n);
    expect(await auction.pendingReturns(bidder2.address)).to.equal(secondBid);
    expect(await auction.pendingReturns(bidder3.address)).to.equal(0n);
  });

  it("finalize() with physical item holds payment until the winner confirms receipt", async function () {
    const physicalTokenId = 2;
    const bidAmount = ethers.parseEther("5");
    const secret = ethers.id("bidder1");
    await mockERC721.mint(seller.address, physicalTokenId);
    const physicalAuction = await createVickreyAuctionForToken(physicalTokenId, 1, reservePrice);

    await physicalAuction.connect(bidder1).commit(commitmentFor(bidAmount, secret), { value: ethers.parseEther("6") });
    await moveToRevealPhase();
    await physicalAuction.connect(bidder1).reveal(bidAmount, secret);
    await time.increase(revealDuration + 1);

    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
    await physicalAuction.finalize();
    const sellerBalanceAfterFinalize = await ethers.provider.getBalance(seller.address);

    expect(sellerBalanceAfterFinalize).to.equal(sellerBalanceBefore);
    expect(await mockERC721.ownerOf(physicalTokenId)).to.equal(bidder1.address);
    expect(await physicalAuction.finalPrice()).to.equal(reservePrice);
    expect(await physicalAuction.isAwaitingConfirmation()).to.equal(true);

    await physicalAuction.connect(bidder1).confirmReceived();
    const sellerBalanceAfterConfirm = await ethers.provider.getBalance(seller.address);

    expect(sellerBalanceAfterConfirm - sellerBalanceBefore).to.equal(reservePrice);
    expect(await physicalAuction.receivedConfirmed()).to.equal(true);
  });

  it("reveal() and finalize() enforce phase boundaries", async function () {
    const bidAmount = ethers.parseEther("2");
    const secret = ethers.id("bidder1");
    const commitment = commitmentFor(bidAmount, secret);

    await auction.connect(bidder1).commit(commitment, { value: bidAmount });
    await expect(auction.connect(bidder1).reveal(bidAmount, secret)).to.be.revertedWith("Reveal phase has not started");
    await expect(auction.finalize()).to.be.revertedWith("Auction not yet ended");

    await movePastRevealPhase();
    await expect(auction.connect(bidder1).reveal(bidAmount, secret)).to.be.revertedWith("Reveal phase has ended");
    await auction.finalize();
    await expect(auction.finalize()).to.be.revertedWith("Auction already finalized");
  });

  it("bid() reverts because Vickrey auctions require commitments", async function () {
    await expect(auction.connect(bidder1).bid({ value: ethers.parseEther("1") })).to.be.revertedWith(
      "Use commit() for VickreyAuction",
    );
  });
});
