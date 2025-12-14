import { createPublicClient, http } from "viem";
import { hardhat, sepolia } from "viem/chains";

const rpcUrl =
  process.env.HARDHAT_RPC_URL || // dev/local
  process.env.NEXT_PUBLIC_INFURA_API_KEY || // full URL possible
  "http://localhost:8545";

const chain = process.env.NODE_ENV === "production" ? sepolia : hardhat;

export const client = createPublicClient({
  chain,
  transport: http(rpcUrl),
});
