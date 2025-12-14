"use client";

import { useAccount, useReadContract } from "wagmi";
import type { Abi } from "viem";
import PatriDefiCustomer from "@/components/shared/PatriDefiCustomer";
import { PatriDefiAdmin } from "@/components/shared/PatriDefiAdmin";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "@/utils/constants";

export default function PatriDefiHome() {
  const { address, isConnected } = useAccount();

  const { data: isAdminData } = useReadContract({
    abi: CONTRACT_ABI as Abi,
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: "isAdmin",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: Boolean(address) },
  });

  const isAdmin = Boolean(isConnected && address && (isAdminData as boolean));

  return (
    <div className="w-full font-sans">
      {!isConnected && (
        <div className="mb-8 text-center text-sm text-muted-foreground">
          Veuillez connecter votre wallet pour continuer.
        </div>
      )}
      {isAdmin ? <PatriDefiAdmin /> : <PatriDefiCustomer />}
    </div>
  );
}
