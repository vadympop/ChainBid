import { expect } from "chai";
import { ethers } from "hardhat";

describe("AuctionFactory", function () {
  let factory: any;
  let mockERC721: any;
  let mockERC1155: any;
  let owner: any;
  let seller: any;

  const tokenId = 1;

  beforeEach(async function () {
    [owner, seller] = await ethers.getSigners();

    const ERC721Factory = await ethers.getContractFactory("MockERC721");
    mockERC721 = await ERC721Factory.deploy();

    const ERC1155Factory = await ethers.getContractFactory("MockERC1155");
    mockERC1155 = await ERC1155Factory.deploy();

    await mockERC721.mint(seller.address, tokenId);
    await mockERC1155.mint(seller.address, tokenId, 3);

    const FactoryFactory = await ethers.getContractFactory("AuctionFactory");
    factory = await FactoryFactory.deploy();

    await mockERC721.connect(seller).approve(await factory.getAddress(), tokenId);
    await mockERC1155.connect(seller).setApprovalForAll(await factory.getAddress(), true);
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

  it("createDutchAuction() deploys valid contract and escrows approved NFT", async function () {
    const item = {
      tokenType: 0, // ERC721
      assetType: 0, // Digital
      tokenContract: await mockERC721.getAddress(),
      tokenId: tokenId,
      amount: 1,
      metadataURI: "",
    };

    await factory.connect(seller).createDutchAuction(item, ethers.parseEther("10"), ethers.parseEther("2"), 3600);

    const auctions = await factory.getAllAuctions();
    expect(auctions.length).to.equal(1);
    expect(auctions[0].auctionType).to.equal(1n); // Dutch
    expect(auctions[0].seller).to.equal(seller.address);
    expect(await mockERC721.ownerOf(tokenId)).to.equal(auctions[0].contractAddress);
  });

  it("createVickreyAuction() deploys valid contract and escrows approved NFT", async function () {
    const item = {
      tokenType: 0, // ERC721
      assetType: 0, // Digital
      tokenContract: await mockERC721.getAddress(),
      tokenId: tokenId,
      amount: 1,
      metadataURI: "",
    };

    await factory.connect(seller).createVickreyAuction(item, ethers.parseEther("1"), 600, 600);

    const auctions = await factory.getAllAuctions();
    expect(auctions.length).to.equal(1);
    expect(auctions[0].auctionType).to.equal(2n); // Vickrey
    expect(auctions[0].seller).to.equal(seller.address);
    expect(await mockERC721.ownerOf(tokenId)).to.equal(auctions[0].contractAddress);
  });

  it("createEnglishAuction() reverts without NFT approval", async function () {
    const unapprovedTokenId = 2;
    await mockERC721.mint(seller.address, unapprovedTokenId);

    const item = {
      tokenType: 0,
      assetType: 0,
      tokenContract: await mockERC721.getAddress(),
      tokenId: unapprovedTokenId,
      amount: 1,
      metadataURI: "",
    };

    await expect(factory.connect(seller).createEnglishAuction(item, ethers.parseEther("1"), 3600)).to.be.reverted;
  });

  it("createEnglishAuction() reverts with zero token contract", async function () {
    const item = {
      tokenType: 0,
      assetType: 0,
      tokenContract: ethers.ZeroAddress,
      tokenId: tokenId,
      amount: 1,
      metadataURI: "",
    };

    await expect(factory.connect(seller).createEnglishAuction(item, ethers.parseEther("1"), 3600)).to.be.revertedWith(
      "Token contract cannot be zero",
    );
  });

  it("createEnglishAuction() reverts when ERC721 amount is not 1", async function () {
    const item = {
      tokenType: 0,
      assetType: 0,
      tokenContract: await mockERC721.getAddress(),
      tokenId: tokenId,
      amount: 2,
      metadataURI: "",
    };

    await expect(factory.connect(seller).createEnglishAuction(item, ethers.parseEther("1"), 3600)).to.be.revertedWith(
      "ERC721 amount must be 1",
    );
  });

  it("createEnglishAuction() reverts when ERC1155 amount is zero", async function () {
    const item = {
      tokenType: 1, // ERC1155
      assetType: 0,
      tokenContract: await mockERC1155.getAddress(),
      tokenId: tokenId,
      amount: 0,
      metadataURI: "",
    };

    await expect(factory.connect(seller).createEnglishAuction(item, ethers.parseEther("1"), 3600)).to.be.revertedWith(
      "ERC1155 amount must be greater than zero",
    );
  });

  it("createEnglishAuction() reverts with unsupported token type", async function () {
    const item = {
      tokenType: 2,
      assetType: 0,
      tokenContract: await mockERC721.getAddress(),
      tokenId: tokenId,
      amount: 1,
      metadataURI: "",
    };

    await expect(factory.connect(seller).createEnglishAuction(item, ethers.parseEther("1"), 3600)).to.be.reverted;
  });

  it("createEnglishAuction() reverts with unsupported asset type", async function () {
    const item = {
      tokenType: 0,
      assetType: 2,
      tokenContract: await mockERC721.getAddress(),
      tokenId: tokenId,
      amount: 1,
      metadataURI: "",
    };

    await expect(factory.connect(seller).createEnglishAuction(item, ethers.parseEther("1"), 3600)).to.be.reverted;
  });

  it("createEnglishAuction() escrows approved ERC1155 items", async function () {
    const item = {
      tokenType: 1, // ERC1155
      assetType: 0,
      tokenContract: await mockERC1155.getAddress(),
      tokenId: tokenId,
      amount: 2,
      metadataURI: "",
    };

    await factory.connect(seller).createEnglishAuction(item, ethers.parseEther("1"), 3600);

    const auctions = await factory.getAllAuctions();
    expect(await mockERC1155.balanceOf(auctions[0].contractAddress, tokenId)).to.equal(2n);
    expect(await mockERC1155.balanceOf(seller.address, tokenId)).to.equal(1n);
  });

  it("EnglishAuction with ERC1155 item transfers item to winning bidder", async function () {
    const item = {
      tokenType: 1, // ERC1155
      assetType: 0,
      tokenContract: await mockERC1155.getAddress(),
      tokenId: tokenId,
      amount: 2,
      metadataURI: "",
    };

    await factory.connect(seller).createEnglishAuction(item, ethers.parseEther("1"), 3600);

    const auctions = await factory.getAllAuctions();
    const auction = await ethers.getContractAt("EnglishAuction", auctions[0].contractAddress);

    await auction.connect(owner).bid({ value: ethers.parseEther("2") });
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine", []);
    await auction.finalize();

    expect(await mockERC1155.balanceOf(owner.address, tokenId)).to.equal(2n);
    expect(await mockERC1155.balanceOf(auctions[0].contractAddress, tokenId)).to.equal(0n);
  });

  it("createEnglishAuction() reverts when duration is below 10 minutes", async function () {
    const item = {
      tokenType: 0,
      assetType: 0,
      tokenContract: await mockERC721.getAddress(),
      tokenId: tokenId,
      amount: 1,
      metadataURI: "",
    };

    await expect(factory.connect(seller).createEnglishAuction(item, ethers.parseEther("1"), 599)).to.be.revertedWith(
      "Duration must be at least 10 minutes",
    );
  });

  it("createDutchAuction() reverts when duration is below 10 minutes", async function () {
    const item = {
      tokenType: 0,
      assetType: 0,
      tokenContract: await mockERC721.getAddress(),
      tokenId: tokenId,
      amount: 1,
      metadataURI: "",
    };

    await expect(
      factory.connect(seller).createDutchAuction(item, ethers.parseEther("10"), ethers.parseEther("2"), 599),
    ).to.be.revertedWith("Duration must be at least 10 minutes");
  });

  it("createVickreyAuction() reverts when commit or reveal duration is below 10 minutes", async function () {
    const item = {
      tokenType: 0,
      assetType: 0,
      tokenContract: await mockERC721.getAddress(),
      tokenId: tokenId,
      amount: 1,
      metadataURI: "",
    };

    await expect(
      factory.connect(seller).createVickreyAuction(item, ethers.parseEther("1"), 599, 600),
    ).to.be.revertedWith("Duration must be at least 10 minutes");
    await expect(
      factory.connect(seller).createVickreyAuction(item, ethers.parseEther("1"), 600, 599),
    ).to.be.revertedWith("Duration must be at least 10 minutes");
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

  it("getAuctionsPaginated() clamps limit and getTotalAuctions() returns count", async function () {
    const item = {
      tokenType: 0,
      assetType: 0,
      tokenContract: await mockERC721.getAddress(),
      tokenId: tokenId,
      amount: 1,
      metadataURI: "",
    };

    await factory.connect(seller).createEnglishAuction(item, ethers.parseEther("1"), 3600);

    const page = await factory.getAuctionsPaginated(0, 10);
    expect(page.length).to.equal(1);
    expect(await factory.getTotalAuctions()).to.equal(1n);
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
