import "dotenv/config";
import { createConfig } from "@ponder/core";
import { http } from "viem";
import type { Abi } from "abitype";
import PatriDeFiArtifact from "../backend/artifacts/contracts/PatriDeFi.sol/PatriDeFi.json" assert { type: "json" };
import PatriDNftArtifact from "../backend/artifacts/contracts/NftPatriD.sol/NftPatriD.json" assert { type: "json" };

const PatriDeFiAbi = PatriDeFiArtifact.abi as Abi;
const PatriDNftAbi = PatriDNftArtifact.abi as Abi;

const isLocal = process.env.PONDER_NETWORK === "localhost";

const requireEnv = <T extends string>(key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value as T;
};

type Networks = Parameters<typeof createConfig>[0]["networks"];
type Contracts = Parameters<typeof createConfig>[0]["contracts"];

const networks: Networks = isLocal
  ? {
      localhost: {
        chainId: 31337,
        transport: http(process.env.PONDER_RPC_URL_LOCAL || "http://127.0.0.1:8545"),
      },
    }
  : {
      sepolia: {
        chainId: 11155111,
        transport: http(requireEnv<string>("PONDER_RPC_URL")),
      },
    };

const contracts: Contracts = isLocal
  ? {
      PatriDeFi: {
        network: "localhost",
        address: requireEnv<`0x${string}`>("PATRI_DEFI_ADDRESS_LOCAL"),
        abi: PatriDeFiAbi,
        startBlock: 0,
      },
      PatriDNft: {
        network: "localhost",
        address: requireEnv<`0x${string}`>("PATRI_D_NFT_ADDRESS_LOCAL"),
        abi: PatriDNftAbi,
        startBlock: 0,
      },
    }
  : {
      PatriDeFi: {
        network: "sepolia",
        address: requireEnv<`0x${string}`>("PATRI_DEFI_ADDRESS"),
        abi: PatriDeFiAbi,
        startBlock: 9813263,
      },
      PatriDNft: {
        network: "sepolia",
        address: requireEnv<`0x${string}`>("PATRI_D_NFT_ADDRESS"),
        abi: PatriDNftAbi,
        startBlock: 9813264,
      },
    };

export default createConfig({
  networks,
  contracts,
});
