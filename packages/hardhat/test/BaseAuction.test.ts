import { expect } from "chai";
import { ethers } from "hardhat";

describe("BaseAuction", function () {
  let mockAuction: any;
  let mockERC721: any;
  let attacker: any;
  let owner: any;
  let addr1: any;

  const tokenId = 1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();

    const ERC721Factory = await ethers.getContractFactory("MockERC721");
    mockERC721 = await ERC721Factory.deploy();

    await mockERC721.mint(owner.address, tokenId);

    const txCount = await owner.getNonce();
    const expectedAddress = ethers.getCreateAddress({
      from: owner.address,
      nonce: txCount + 1,
    });

    await mockERC721.approve(expectedAddress, tokenId);

    const AuctionFactory = await ethers.getContractFactory("MockBaseAuction");
    const item = {
      itemType: 0, // ERC721
      tokenContract: await mockERC721.getAddress(),
      tokenId: tokenId,
      amount: 1,
      metadataURI: "",
    };

    mockAuction = await AuctionFactory.deploy();
    await mockAuction.initialize(item, owner.address, 3600, ethers.parseEther("1"));
  });

  describe("Escrow and Transfer", function () {
    it("should escrow NFT into contract on deploy", async function () {
      const auctionAddress = await mockAuction.getAddress();
      expect(await mockERC721.ownerOf(tokenId)).to.equal(auctionAddress);
    });

    it("should transfer NFT to correct address", async function () {
      await mockAuction.transferItem(addr1.address);
      expect(await mockERC721.ownerOf(tokenId)).to.equal(addr1.address);
    });
  });

  describe("Withdrawals", function () {
    it("withdraw() reverts if nothing owed", async function () {
      await expect(mockAuction.connect(addr1).withdraw()).to.be.revertedWith("No pending returns");
    });

    it("withdraw() correctly sends ETH and clears balance", async function () {
      // Set pending return
      await mockAuction.setPendingReturn(addr1.address, ethers.parseEther("1"));

      // Send ETH to contract to cover withdrawal
      await owner.sendTransaction({
        to: await mockAuction.getAddress(),
        value: ethers.parseEther("1"),
      });

      const initialBalance = await ethers.provider.getBalance(addr1.address);
      const tx = await mockAuction.connect(addr1).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const finalBalance = await ethers.provider.getBalance(addr1.address);
      expect(finalBalance).to.equal(initialBalance + ethers.parseEther("1") - BigInt(gasUsed));

      expect(await mockAuction.pendingReturns(addr1.address)).to.equal(0n);
    });

    it("reentrancy attack on withdraw() is blocked", async function () {
      const AttackerFactory = await ethers.getContractFactory("WithdrawAttacker");
      attacker = await AttackerFactory.deploy(await mockAuction.getAddress());

      // Set pending return for attacker
      const attackerAddress = await attacker.getAddress();
      await mockAuction.setPendingReturn(attackerAddress, ethers.parseEther("1"));

      // Fund the auction contract
      await owner.sendTransaction({
        to: await mockAuction.getAddress(),
        value: ethers.parseEther("2"),
      });

      await expect(attacker.attack()).to.be.revertedWith("Withdrawal failed");
    });
  });
});
