import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { hardhat, sepolia } from "viem/chains";

// Minimal ABI just for goldTokens()
const PATRI_D_NFT_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "goldTokens",
    outputs: [
      { internalType: "bytes32", name: "supabaseId", type: "bytes32" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "goldPrice", type: "uint256" },
      { internalType: "uint8", name: "quality", type: "uint8" },
      { internalType: "uint256", name: "pieceValue", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
];

const qualityLabels = ["TB", "TTB", "SUP", "SPL", "FDC"];

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id?: string }> },
) {
  const pathname = new URL(req.url).pathname;
  const providedParams = await ctx.params;
  const rawId =
    providedParams?.id ??
    pathname.split("/").filter(Boolean).pop() ??
    "0";
  const id = rawId.replace(/\.json$/i, "");
  const origin = new URL(req.url).origin;

  // Defaults
  const metadataBase = {
    name: `PatriD #${id}`,
    description: "Napoléon tokenisé",
    image: `${origin}/napoleon.png`,
    attributes: [
      { trait_type: "Asset", value: "Napoléon" },
      { trait_type: "Token ID", value: id },
    ],
  };

  const rpcUrl =
    process.env.HARDHAT_RPC_URL || // local/dev
    process.env.NEXT_PUBLIC_INFURA_API_KEY || // full URL possible
    "http://localhost:8545";

  const patriDAddress = process.env.NEXT_PUBLIC_PATRI_D_NFT_ADDRESS as
    | `0x${string}`
    | undefined;

  if (!patriDAddress) {
    return NextResponse.json(metadataBase);
  }

  try {
    const chain = process.env.NODE_ENV === "production" ? sepolia : hardhat;
    const client = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    const [supabaseId, amount, goldPrice, quality, pieceValue] =
      (await client.readContract({
        address: patriDAddress,
        abi: PATRI_D_NFT_ABI,
        functionName: "goldTokens",
        args: [BigInt(id)],
      })) as [
        `0x${string}`,
        bigint,
        bigint,
        number,
        bigint,
      ];

    // If no data (all zeros), consider token not found
    const isEmpty =
      supabaseId === "0x0000000000000000000000000000000000000000000000000000000000000000" &&
      amount === BigInt(0) &&
      goldPrice === BigInt(0) &&
      pieceValue === BigInt(0);
    if (isEmpty) {
      return NextResponse.json(
        { error: "Token introuvable" },
        { status: 404 }
      );
    }

    const meta = {
      ...metadataBase,
      attributes: [
        ...metadataBase.attributes,
        { trait_type: "Supabase ID", value: supabaseId },
        { trait_type: "Amount", value: Number(amount) },
        { trait_type: "Gold Price (feed)", value: goldPrice.toString() },
        {
          trait_type: "Quality",
          value: qualityLabels[Number(quality)] ?? String(quality),
        },
        { trait_type: "Piece Value", value: pieceValue.toString() },
      ],
    };

    return NextResponse.json(meta);
  } catch (error) {
    // If anything fails (no RPC, bad id, etc.), return 404
    return NextResponse.json(
      { error: "Token introuvable" },
      { status: 404 }
    );
  }
}
/* eslint-disable @typescript-eslint/no-unused-vars */
