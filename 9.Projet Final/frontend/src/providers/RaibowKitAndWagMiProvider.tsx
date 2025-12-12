'use client';
import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { hardhat, sepolia } from 'wagmi/chains';
import {
  QueryClientProvider,
  QueryClient,
} from "@tanstack/react-query";


const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

if (!projectId) {
  console.warn("NEXT_PUBLIC_WC_PROJECT_ID is not set; WalletConnect will be unavailable.");
}

const config = getDefaultConfig({
  appName: 'PatriDeFi',
  projectId: projectId ?? 'placeholder',
  chains: [sepolia, hardhat],
  ssr: true, // SSR enabled
});

const queryClient = new QueryClient();

const RaibowKitAndWagMiProvider = ({children} : {children: React.ReactNode}) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
            theme={darkTheme({
            accentColor: '#7b3fe4',
            accentColorForeground: 'white',
            borderRadius: 'small',
            fontStack: 'system',
            overlayBlur: 'small',
        })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default RaibowKitAndWagMiProvider;
