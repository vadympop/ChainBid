import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployFactory: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("AuctionFactory", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });
};

export default deployFactory;

deployFactory.tags = ["AuctionFactory"];
