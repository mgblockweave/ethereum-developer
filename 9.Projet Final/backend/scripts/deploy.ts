import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Deploy ERC1155
  const Gold1155 = await ethers.getContractFactory("Gold1155");
  const gold1155 = await Gold1155.deploy("https://example.com/{id}.json");
  await gold1155.waitForDeployment();
  const gold1155Address = await gold1155.getAddress();
  console.log("Gold1155 deployed at:", gold1155Address);

  // Deploy PatriDeFi pointing to Gold1155 (respect exact contract name)
  const PatriDeFi = await ethers.getContractFactory("PatriDeFi");
  const patriDeFi = await PatriDeFi.deploy(gold1155Address);
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
