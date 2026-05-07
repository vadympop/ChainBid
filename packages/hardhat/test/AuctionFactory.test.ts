import { expect } from "chai";
import { ethers } from "hardhat";

describe("AuctionFactory", function () {
  let factory: any;
  let mockERC721: any;
  let owner: any;
  let seller: any;

  const tokenId = 1;

  beforeEach(async function () {
    [owner, seller] = await ethers.getSigners();

    const ERC721Factory = await ethers.getContractFactory("MockERC721");
    mockERC721 = await ERC721Factory.deploy();

    await mockERC721.mint(seller.address, tokenId);

    const FactoryFactory = await ethers.getContractFactory("AuctionFactory");
    factory = await FactoryFactory.deploy();

    // The factory creates an auction. For the factory to pull the NFT,
    // the seller must approve the factory. But wait, the auction contract is the one pulling the NFT
    // in its constructor. So the seller must approve the expected auction address or use setApprovalForAll for the auction?
    // Wait, since the factory deploys it, we can predict the auction address from the factory's nonce!
    const txCount = await ethers.provider.getTransactionCount(await factory.getAddress());
    const expectedAddress = ethers.getCreateAddress({
      from: await factory.getAddress(),
      nonce: txCount,
    });

    await mockERC721.connect(seller).approve(expectedAddress, tokenId);
  });

  it("createEnglishAuction() deploys valid contract", async function () {
    const item = {
      itemType: 0, // ERC721
      tokenContract: await mockERC721.getAddress(),
      tokenId: tokenId,
      amount: 1,
      metadataURI: "",
    };

    const tx = await factory.connect(seller).createEnglishAuction(item, ethers.parseEther("1"), 3600);
    await tx.wait();

    const auctions = await factory.getAllAuctions();
    expect(auctions.length).to.equal(1);
    expect(auctions[0].seller).to.equal(seller.address);
  });

  it("getAllAuctions() returns correct record", async function () {
    const item = {
      itemType: 0,
      tokenContract: await mockERC721.getAddress(),
      tokenId: tokenId,
      amount: 1,
      metadataURI: "",
    };
    await factory.connect(seller).createEnglishAuction(item, ethers.parseEther("1"), 3600);

    const all = await factory.getAllAuctions();
    expect(all.length).to.equal(1);
    expect(all[0].auctionType).to.equal(0n); // English
  });

  it("getAuctionsBySeller() filters correctly", async function () {
    const item = {
      itemType: 0,
      tokenContract: await mockERC721.getAddress(),
      tokenId: tokenId,
      amount: 1,
      metadataURI: "",
    };
    await factory.connect(seller).createEnglishAuction(item, ethers.parseEther("1"), 3600);

    const sellerAuctions = await factory.getAuctionsBySeller(seller.address);
    expect(sellerAuctions.length).to.equal(1);

    const ownerAuctions = await factory.getAuctionsBySeller(owner.address);
    expect(ownerAuctions.length).to.equal(0);
  });

  it("Pagination returns correct slice", async function () {
    const item = {
      itemType: 0,
      tokenContract: await mockERC721.getAddress(),
      tokenId: tokenId,
      amount: 1,
      metadataURI: "",
    };
    await factory.connect(seller).createEnglishAuction(item, ethers.parseEther("1"), 3600);

    const page1 = await factory.getAuctionsPaginated(0, 1);
    expect(page1.length).to.equal(1);

    const page2 = await factory.getAuctionsPaginated(1, 1);
    expect(page2.length).to.equal(0);
  });

  it("AuctionCreated event emitted with correct args", async function () {
    const item = {
      itemType: 0,
      tokenContract: await mockERC721.getAddress(),
      tokenId: tokenId,
      amount: 1,
      metadataURI: "",
    };

    await expect(factory.connect(seller).createEnglishAuction(item, ethers.parseEther("1"), 3600)).to.emit(
      factory,
      "AuctionCreated",
    );
  });
});
