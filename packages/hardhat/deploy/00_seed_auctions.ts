import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "ethers";

const seedAuctions: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // 1. Deploy MockERC721
  const mockToken = await deploy("MockERC721", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  const mockContract = await hre.ethers.getContractAt("MockERC721", mockToken.address);

  // 2. Mint tokens to deployer
  const tokenId1 = 1n;
  const tokenId2 = 2n;

  try {
    await mockContract.ownerOf(tokenId1);
  } catch {
    await mockContract.mint(deployer, tokenId1);
  }
  try {
    await mockContract.ownerOf(tokenId2);
  } catch {
    await mockContract.mint(deployer, tokenId2);
  }

  // 3. Get deployed Factory
  const factoryDeployment = await hre.deployments.get("AuctionFactory");
  const factory = await hre.ethers.getContractAt("AuctionFactory", factoryDeployment.address);
  const deployerSigner = await hre.ethers.provider.getSigner(deployer);

  // Approve Factory for all (since we want to create multiple auctions)
  await mockContract.connect(deployerSigner).setApprovalForAll(factoryDeployment.address, true);

  const duration = 3600; // 1 hour

  // 4. Create English Auction
  const englishItem = {
    itemType: 0, // ERC721
    tokenContract: mockToken.address,
    tokenId: tokenId1,
    amount: 1,
    metadataURI: "",
  };
  const englishReserve = parseEther("1");

  console.log("Creating English Auction...");
  const tx1 = await factory.connect(deployerSigner).createEnglishAuction(englishItem, englishReserve, duration);
  await tx1.wait();
  console.log("English Auction created.");

  // 5. Create Dutch Auction
  const dutchItem = {
    itemType: 0, // ERC721
    tokenContract: mockToken.address,
    tokenId: tokenId2,
    amount: 1,
    metadataURI: "",
  };
  const dutchStart = parseEther("10");
  const dutchReserve = parseEther("2");

  console.log("Creating Dutch Auction...");
  const tx2 = await factory.connect(deployerSigner).createDutchAuction(dutchItem, dutchStart, dutchReserve, duration);
  await tx2.wait();
  console.log("Dutch Auction created.");
};

export default seedAuctions;

seedAuctions.tags = ["SeedAuctions"];
seedAuctions.dependencies = ["AuctionFactory"];
