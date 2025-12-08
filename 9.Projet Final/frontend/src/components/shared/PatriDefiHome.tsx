"use client";

import { useAccount } from "wagmi";
import PatriDefiCustomer from "@/components/shared/PatriDefiCustomer";
import { PatriDefiAdmin } from "@/components/shared/PatriDefiAdmin";
import { ADMIN_ADDRESS } from "@/utils/constants";

export default function PatriDefiHome() {
  const { address, isConnected } = useAccount();

  // Compute admin flag
  const isAdmin =
    isConnected &&
    address !== undefined &&
    address.toLowerCase() === ADMIN_ADDRESS.toLowerCase();

  return (
    <div className="flex items-start justify-center bg-zinc-50 font-sans dark:bg-black">
      {!isConnected && (
        <div className="mb-8 text-center text-sm text-muted-foreground">
          Veuillez connecter votre wallet pour continuer.
        </div>
      )}

      {isAdmin ? (
        <PatriDefiAdmin />
      ) : (
        <PatriDefiCustomer />
      )}
    </div>
  );
}
