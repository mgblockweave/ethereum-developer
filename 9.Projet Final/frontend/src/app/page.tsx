'use client';
import NotConnected from "@/components/shared/NotConnected";
import PatriDefiHome from "@/components/shared/PatriDefiHome";
import { useAccount } from "wagmi";

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="flex min-h-screen items-center justify-center font-sans">
      {isConnected ? (
        <PatriDefiHome />
      ) : (
        <NotConnected />
      )}
    </div>
  );
}
