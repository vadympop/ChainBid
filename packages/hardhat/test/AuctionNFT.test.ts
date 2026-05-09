import { expect } from "chai";
import { ethers } from "hardhat";

describe("AuctionNFT", function () {
  it("mint() creates an NFT owned by the recipient with the correct tokenURI", async function () {
    const [, user] = await ethers.getSigners();
    const tokenURI = "ipfs://bafybeigdyrzt/demo-metadata.json";

    const AuctionNFTFactory = await ethers.getContractFactory("AuctionNFT");
    const auctionNFT = await AuctionNFTFactory.deploy();

    await expect(auctionNFT.mint(user.address, tokenURI)).to.emit(auctionNFT, "Transfer");

    expect(await auctionNFT.ownerOf(0)).to.equal(user.address);
    expect(await auctionNFT.tokenURI(0)).to.equal(tokenURI);
  });

  it("mint() increments token IDs", async function () {
    const [, user] = await ethers.getSigners();

    const AuctionNFTFactory = await ethers.getContractFactory("AuctionNFT");
    const auctionNFT = await AuctionNFTFactory.deploy();

    await auctionNFT.mint(user.address, "ipfs://metadata-0");
    await auctionNFT.mint(user.address, "ipfs://metadata-1");

    expect(await auctionNFT.ownerOf(0)).to.equal(user.address);
    expect(await auctionNFT.ownerOf(1)).to.equal(user.address);
    expect(await auctionNFT.tokenURI(0)).to.equal("ipfs://metadata-0");
    expect(await auctionNFT.tokenURI(1)).to.equal("ipfs://metadata-1");
  });
});
