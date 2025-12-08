import { createPublicClient, http } from "viem";
import { hardhat } from "viem/chains";
export const client = createPublicClient({
  chain: hardhat,
  transport: http(process.env.HARDHAT_RPC_URL),
});