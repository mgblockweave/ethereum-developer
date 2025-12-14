import { network } from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load backend/.env.local first, then fallback to .env
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const DEMO_MINT = false;

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  const { chainId, name } = await ethers.provider.getNetwork();
  const isLocal =
    chainId === 31337n ||
    name.toLowerCase().includes("hardhat") ||
    name.toLowerCase().includes("localhost");
  console.log("Deploying with (owner):", deployer.address);
  console.log("Network:", name, "chainId:", chainId.toString());

  // Base URI: must be provided via BASE_URI env variable
  if (!process.env.BASE_URI) {
    throw new Error("Missing BASE_URI. Set BASE_URI (e.g. https://patridefi.vercel.app/api/metadata/).");
  }
  const baseUri = process.env.BASE_URI;

  // Deploy mock price feed (gold price per ounce, 8 decimals). Example: 2000 USD = 2000 * 1e8
  const MockGoldPriceFeed = await ethers.getContractFactory("MockGoldPriceFeed");
  const priceFeed = await MockGoldPriceFeed.deploy(2_000_00000000);
  await priceFeed.waitForDeployment();
  const priceFeedAddress = await priceFeed.getAddress();
  console.log("MockGoldPriceFeed deployed at:", priceFeedAddress);

  // Deploy ERC1155
  const NftPatriD = await ethers.getContractFactory("NftPatriD");
  const nftPatriD = await NftPatriD.deploy(baseUri);
  await nftPatriD.waitForDeployment();
  const nftPatriDAddress = await nftPatriD.getAddress();
  console.log("NftPatriD (ERC1155) deployed at:", nftPatriDAddress);

  // Deploy PatriDeFi pointing to ERC1155 and price feed
  const PatriDeFi = await ethers.getContractFactory("PatriDeFi");
  const patriDeFi = await PatriDeFi.deploy(nftPatriDAddress, priceFeedAddress);
  await patriDeFi.waitForDeployment();
  const patriDeFiAddress = await patriDeFi.getAddress();
  console.log("PatriDeFi deployed at:", patriDeFiAddress);

  // Set PatriDeFi as minter on NftPatriD
  const tx = await nftPatriD.setMinter(patriDeFiAddress);
  await tx.wait();
  console.log("NftPatriD minter set to PatriDeFi");

  // Ensure URI points to the desired metadata endpoint
  const baseTx = await nftPatriD.setBaseURI(baseUri);
  await baseTx.wait();
  console.log("NftPatriD base URI set to:", baseUri);

  const demoMintEnabled = DEMO_MINT && isLocal;
  if (demoMintEnabled) {
    const supabaseId = ethers.keccak256(ethers.toUtf8Bytes("demo-customer"));
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("demo-payload"));
    const weightsMg = [31_000]; // ~1 Napoleon (mg)
    const qualities = [0]; // Quality.TB
    const mintTx = await patriDeFi.registerCustomerAndMintDetailed(
      deployer.address,
      supabaseId,
      dataHash,
      weightsMg,
      qualities
    );
    await mintTx.wait();
    const tokenUri = await nftPatriD.uri(1);
    console.log("Demo token #1 minted to admin. URI:", tokenUri);
  }

  // Propagate addresses to frontend/ponder env files when running locally
  if (isLocal) {
    upsertEnv("../../frontend/.env.local", {
      NEXT_PUBLIC_PATRI_D_NFT_ADDRESS: nftPatriDAddress,
      NEXT_PUBLIC_PATRI_DEFI_ADDRESS: patriDeFiAddress,
    });
    upsertEnv("../../frontend/.env.local.hardhat", {
      NEXT_PUBLIC_PATRI_D_NFT_ADDRESS: nftPatriDAddress,
      NEXT_PUBLIC_PATRI_DEFI_ADDRESS: patriDeFiAddress,
    });
    upsertEnv("../../ponder/.env.local", {
      NEXT_PUBLIC_PATRI_D_NFT_ADDRESS: nftPatriDAddress,
      NEXT_PUBLIC_PATRI_DEFI_ADDRESS: patriDeFiAddress,
    });
  } else {
    console.log("Non-local network detected; skip env auto-update. Copy addresses manually to your prod env files.");
  }
}

function upsertEnv(relativePath: string, updates: Record<string, string>) {
  // __dirname replacement for ESM
  const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), relativePath);
  let content = "";
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, "utf8");
  }

  for (const [key, value] of Object.entries(updates)) {
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(content)) {
      content = content.replace(re, `${key}=${value}`);
    } else {
      if (content && !content.endsWith("\n")) {
        content += "\n";
      }
      content += `${key}=${value}\n`;
    }
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${filePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
