import { createConfig } from "@ponder/core";
import { http } from "viem";
import PatriDeFiArtifact from "../backend/artifacts/contracts/PatriDeFi.sol/PatriDeFi.json" assert { type: "json" };
import Gold1155Artifact from "../backend/artifacts/contracts/Gold1155.sol/Gold1155.json" assert { type: "json" };

// Addresses par défaut (Sepolia) - peuvent être surchargées via l'env
// Dernier déploiement (hardhat log du user):
// PatriDeFi: 0xE152DDeb7181d867787e1B71aAcd14888255Af9d
// Gold1155:  0x1c086F8B98200CA2536856b01dbC744fA2Bc231f
const DEFAULT_PATRI_DEFI = "0xE152DDeb7181d867787e1B71aAcd14888255Af9d";
const DEFAULT_GOLD1155 = "0x1c086F8B98200CA2536856b01dbC744fA2Bc231f";

export default createConfig({
  networks: {
    sepolia: {
      chainId: 11155111,
      transport: http(process.env.PONDER_RPC_URL || ""),
    },
  },
  contracts: {
    PatriDeFi: {
      network: "sepolia",
      address: (process.env.PATRI_DEFI_ADDRESS || DEFAULT_PATRI_DEFI) as `0x${string}`,
      abi: PatriDeFiArtifact.abi as any,
      startBlock: 9813263,
    },
    Gold1155: {
      network: "sepolia",
      address: (process.env.GOLD1155_ADDRESS || DEFAULT_GOLD1155) as `0x${string}`,
      abi: Gold1155Artifact.abi as any,
      startBlock: 9813264,
    },
  },
});
