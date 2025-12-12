# AI Coding Agent Instructions for ethereum-developer

## Project Overview

This is an **Ethereum developer learning repository** organized by topic (Solidity, Hardhat, Foundry, Testing) with a final capstone project (`9. Projet Final`) that combines:
- **Backend**: ERC1155 NFT contracts (patriD, PatriDeFi) deployed with Hardhat 3 Beta
- **Frontend**: Next.js + wagmi + RainbowKit dApp for on-chain interaction

The project demonstrates bridging off-chain data (Supabase) with on-chain smart contracts.

## Architecture

### Backend (`9.Projet Final/backend`)

**Key contracts:**
- `patriD.sol` - ERC1155 token contract for gold positions; mints tokens called by PatriDeFi
- `PatriDeFi.sol` - Owner-controlled coordinator that bridges Supabase customer records to on-chain; calls patriD to mint

**Critical pattern**: PatriDeFi acts as the minter for patriD. Off-chain flow:
1. Save customer data to Supabase
2. Compute `dataHash = keccak256(JSON payload)` and `supabaseId = keccak256(UUID)`
3. Call `PatriDeFi.registerAndMintPosition()` from admin wallet
4. PatriDeFi internally calls `patriD.mintForCustomer()`

**Stack**:
- Hardhat 3 Beta (latest, with EDR simulated networks)
- ethers.js v6 + TypeScript
- Mocha + Chai for tests
- Hardhat Ignition for deployments
- OpenZeppelin Contracts (v5.4.0) for ERC1155 and Ownable
- Networks: hardhatMainnet, hardhatOp (simulated), sepolia (testnet)

**Test pattern** (`test/Counter.ts`):
```typescript
const { ethers } = await network.connect(); // Connect to hardhat network
const counter = await ethers.deployContract("Counter");
await expect(counter.inc()).to.emit(counter, "Increment").withArgs(1n);
```

### Frontend (`9.Projet Final/frontend`)

**Stack**:
- Next.js 16 with TypeScript
- wagmi + viem for Ethereum interactions
- RainbowKit for wallet connection (dark theme)
- TailwindCSS + shadcn/ui for components
- React Query for async state

**Key provider**: `RaibowKitAndWagMiProvider.tsx` wraps app with wagmi config (hardhat chain, ProjectID required)

**Client setup** (`utils/client.ts`): Creates viem PublicClient connected to Hardhat RPC (env var: `HARDHAT_RPC_URL`)

## Critical Workflows

### Backend Tests & Deployment

**Run tests**:
```bash
cd backend
npm run test  # Runs all mocha tests
```

**Deploy contracts** (Hardhat Ignition):
```bash
# Local hardhat network
npx hardhat ignition deploy ignition/modules/Counter.ts

# Sepolia testnet (requires SEPOLIA_PRIVATE_KEY set via hardhat-keystore)
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npx hardhat ignition deploy --network sepolia ignition/modules/Counter.ts
```

**Verify on Etherscan** (hardhat-verify plugin):
- Etherscan API key already in `hardhat.config.ts`
- Extend verification as needed for new contracts

### Frontend Development

```bash
cd frontend
npm run dev        # Starts Next.js dev server on :3000
npm run build      # Production build
npm run lint       # ESLint check
```

**Environment**: Ensure `HARDHAT_RPC_URL` points to running Hardhat node or OP mainnet simulation.

## Project-Specific Patterns

### 1. **Solidity Conventions**
- Use pragma `^0.8.20` (current project default)
- Import from OpenZeppelin v5.4.0 for standards
- Include `@notice` and `@param` NatSpec comments for contract documentation
- Use `bytes32` for Supabase identifiers (hashed UUIDs)
- Emit events for critical state changes (minting, role updates)

### 2. **TypeScript in Hardhat**
- Use `network.connect()` in tests to access ethers (Hardhat 3 pattern)
- Deploy via `ethers.deployContract("ContractName")` (auto-finds ABI)
- Query events: `contract.queryFilter(contract.filters.EventName(), startBlock, endBlock)`
- BigInt literals: use `n` suffix (e.g., `1n`, `5n`) for 0.8.20 compatibility

### 3. **Ignition Modules**
- Place in `ignition/modules/` with pattern: `buildModule("ModuleName", (m) => { ... })`
- Use `m.contract("ContractName")` to deploy
- Use `m.call()` for post-deployment initialization
- Returns object with deployed instances for reference

### 4. **Frontend Integration**
- wagmi config uses `hardhat` chain by default; update `projectId` in `RaibowKitAndWagMiProvider.tsx`
- All viem/wagmi calls use Hardhat RPC endpoint
- Components wrap in layout that injects providers
- Use TailwindCSS with `dark` mode (set in `layout.tsx` root)

### 5. **Testing Structure**
- Tests live in `test/` alongside contracts (not in `contracts/test/`)
- Both mocha (TypeScript, `test/*.ts`) and Solidity (`contracts/*.t.sol`) tests supported
- Run `npx hardhat test mocha` or `npx hardhat test solidity` selectively

## Key Files to Reference

| File | Purpose |
|------|---------|
| `backend/hardhat.config.ts` | Network config, plugin setup, Solidity profiles (default & production) |
| `backend/contracts/patriD.sol` | ERC1155 core logic; minter pattern |
| `backend/contracts/PatriDeFi.sol` | Admin coordinator; Supabase ↔ blockchain bridge |
| `backend/ignition/modules/Counter.ts` | Ignition deployment template |
| `frontend/src/providers/RaibowKitAndWagMiProvider.tsx` | Wagmi + RainbowKit setup |
| `frontend/src/utils/client.ts` | viem PublicClient for read-only calls |

## Important Notes

- **Hardhat 3 Beta**: Use `network.connect()` for ethers access; older Hardhat patterns differ
- **EDR Simulated Networks**: `hardhatMainnet` and `hardhatOp` are built-in fast simulations; no separate local node needed for most development
- **Configuration Variables**: Use `configVariable()` in hardhat.config for secrets (SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL)
- **Private Keys**: Never commit `.env` or keys; use hardhat-keystore plugin to store securely
- **Contracts Deploy Order**: PatriDeFi depends on patriD; deploy patriD first, pass address to PatriDeFi constructor

## Testing AI-Generated Code

When adding contracts or features:
1. Write tests in `test/*.ts` using mocha + ethers patterns from `test/Counter.ts`
2. Verify NatSpec comments are complete for external/public functions
3. Run `npm run test` before committing
4. Check Solidity syntax against 0.8.20 (no newer features)
