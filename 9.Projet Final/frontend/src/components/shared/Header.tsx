import { ConnectButton } from "@rainbow-me/rainbowkit";
import Layout from "@/components/shared/Layout";
import Image from "next/image";

const Header = () => {
  return (
    <header className="flex items-center justify-between p-1 border-b border-gray-200">
         <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image
            src="/napoleon.png"
            alt="Napoléon d'or"
            width={64}
            height={64}
            className="rounded-full shadow-md"
          />
        </div>
              <h1 className="text-2xl font-bold">PatriDefi</h1>
      </div>

      <ConnectButton />
    </header>
  );
}

export default  Header;
/* eslint-disable @typescript-eslint/no-unused-vars */
