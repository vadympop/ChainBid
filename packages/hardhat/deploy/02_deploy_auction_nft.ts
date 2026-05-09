import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployAuctionNFT: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("AuctionNFT", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });
};

export default deployAuctionNFT;

deployAuctionNFT.tags = ["AuctionNFT"];
