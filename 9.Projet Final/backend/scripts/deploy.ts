import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Deploy mock price feed (gold price per ounce, 8 decimals). Example: 2000 USD = 2000 * 1e8
  const MockGoldPriceFeed = await ethers.getContractFactory("MockGoldPriceFeed");
  const priceFeed = await MockGoldPriceFeed.deploy(2_000_00000000);
  await priceFeed.waitForDeployment();
  const priceFeedAddress = await priceFeed.getAddress();
  console.log("MockGoldPriceFeed deployed at:", priceFeedAddress);

  // Deploy ERC1155
  const Gold1155 = await ethers.getContractFactory("Gold1155");
  const gold1155 = await Gold1155.deploy("https://patridefi.example/metadata/");
  await gold1155.waitForDeployment();
  const gold1155Address = await gold1155.getAddress();
  console.log("Gold1155 deployed at:", gold1155Address);

  // Deploy PatriDeFi pointing to Gold1155 and price feed (respect exact contract name)
  const PatriDeFi = await ethers.getContractFactory("PatriDeFi");
  const patriDeFi = await PatriDeFi.deploy(gold1155Address, priceFeedAddress);
  await patriDeFi.waitForDeployment();
  const patriDeFiAddress = await patriDeFi.getAddress();
  console.log("PatriDeFi deployed at:", patriDeFiAddress);

  // Set PatriDefi as minter on Gold1155
  const tx = await gold1155.setMinter(patriDeFiAddress);
  await tx.wait();
  console.log("Gold1155 minter set to PatriDefi");

  console.log("Admin/Owner (for NEXT_PUBLIC_ADMIN_ADDRESS):", deployer.address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
