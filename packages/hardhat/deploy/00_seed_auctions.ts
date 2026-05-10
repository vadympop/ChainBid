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

  // 2. Mint unique tokens to deployer
  const timestamp = BigInt(Date.now());
  const tokenId1 = timestamp;
  const tokenId2 = timestamp + 1n;
  const tokenId3 = timestamp + 2n;

  await mockContract.mint(deployer, tokenId1, { gasLimit: 200_000 });
  await mockContract.mint(deployer, tokenId2, { gasLimit: 200_000 });
  await mockContract.mint(deployer, tokenId3, { gasLimit: 200_000 });

  // 3. Get deployed Factory
  const factoryDeployment = await hre.deployments.get("AuctionFactory");
  const factory = await hre.ethers.getContractAt("AuctionFactory", factoryDeployment.address);
  const deployerSigner = await hre.ethers.provider.getSigner(deployer);

  const factoryAddress = factoryDeployment.address;

  // Approve the factory to escrow these NFTs into newly created auction clones.
  await mockContract.connect(deployerSigner).approve(factoryAddress, tokenId1, { gasLimit: 200_000 });
  await mockContract.connect(deployerSigner).approve(factoryAddress, tokenId2, { gasLimit: 200_000 });
  await mockContract.connect(deployerSigner).approve(factoryAddress, tokenId3, { gasLimit: 200_000 });

  const duration = 3600; // 1 hour

  // 4. Create English Auction
  const englishItem = {
    tokenType: 0, // ERC721
    assetType: 0, // Digital
    tokenContract: mockToken.address,
    tokenId: tokenId1,
    amount: 1,
    metadataURI: "",
  };
  const englishReserve = parseEther("1");

  console.log("Creating English Auction...");
  const tx1 = await factory
    .connect(deployerSigner)
    .createEnglishAuction(englishItem, englishReserve, duration, { gasLimit: 1_000_000 });
  await tx1.wait();
  console.log("English Auction created.");

  // 5. Create Dutch Auction
  const dutchItem = {
    tokenType: 0, // ERC721
    assetType: 0, // Digital
    tokenContract: mockToken.address,
    tokenId: tokenId2,
    amount: 1,
    metadataURI: "",
  };
  const dutchStart = parseEther("10");
  const dutchReserve = parseEther("2");

  console.log("Creating Dutch Auction...");
  const tx2 = await factory
    .connect(deployerSigner)
    .createDutchAuction(dutchItem, dutchStart, dutchReserve, duration, { gasLimit: 1_000_000 });
  await tx2.wait();
  console.log("Dutch Auction created.");

  // 6. Create Vickrey Auction
  const vickreyItem = {
    tokenType: 0, // ERC721
    assetType: 0, // Digital
    tokenContract: mockToken.address,
    tokenId: tokenId3,
    amount: 1,
    metadataURI: "",
  };
  const vickreyReserve = parseEther("1");
  const commitDuration = 1800; // 30 minutes
  const revealDuration = 1800; // 30 minutes

  console.log("Creating Vickrey Auction...");
  const tx3 = await factory
    .connect(deployerSigner)
    .createVickreyAuction(vickreyItem, vickreyReserve, commitDuration, revealDuration, { gasLimit: 1_000_000 });
  await tx3.wait();
  console.log("Vickrey Auction created.");
};

export default seedAuctions;

seedAuctions.tags = ["SeedAuctions"];
seedAuctions.dependencies = ["AuctionFactory"];
