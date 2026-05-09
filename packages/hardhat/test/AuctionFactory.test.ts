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

    await mockERC721.connect(seller).approve(await factory.getAddress(), tokenId);
  });

  it("createEnglishAuction() deploys valid contract", async function () {
    const item = {
      tokenType: 0, // ERC721
      assetType: 0, // Digital
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
    expect(await mockERC721.ownerOf(tokenId)).to.equal(auctions[0].contractAddress);
  });

  it("createEnglishAuction() escrows a physical item represented by ERC721", async function () {
    const item = {
      tokenType: 0, // ERC721
      assetType: 1, // Physical
      tokenContract: await mockERC721.getAddress(),
      tokenId: tokenId,
      amount: 1,
      metadataURI: "",
    };

    await factory.connect(seller).createEnglishAuction(item, ethers.parseEther("1"), 3600);

    const auctions = await factory.getAllAuctions();
    const auction = await ethers.getContractAt("EnglishAuction", auctions[0].contractAddress);
    const auctionInfo = await auction.getAuctionInfo();

    expect(auctionInfo.item.tokenType).to.equal(0n);
    expect(auctionInfo.item.assetType).to.equal(1n);
    expect(await mockERC721.ownerOf(tokenId)).to.equal(auctions[0].contractAddress);
  });

  it("getAllAuctions() returns correct record", async function () {
    const item = {
      tokenType: 0,
      assetType: 0,
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
      tokenType: 0,
      assetType: 0,
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
      tokenType: 0,
      assetType: 0,
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
      tokenType: 0,
      assetType: 0,
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
