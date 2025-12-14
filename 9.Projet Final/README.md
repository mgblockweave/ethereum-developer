# PatriDeFi / NftPatriD

![PatriDeFi](frontend/public/patridefi.png)

Plateforme de tokenisation de Napoléons d’or : données clients en offchain Supabase (RGPD des données clients), enregistrement on-chain via `PatriDeFi` (logique/roles) et `NftPatriD` (ERC1155). Front Next.js + RainbowKit/Wagmi, indexation Ponder.

## Aperçu rapide
- Admin encode le client (Supabase) et mint des ERC1155 (une pièce = un token).
- Contrats : mint PatriD, gestion des admins et gestion des mints (PatriDefi), oracle prix (mock en dev).
- Front : UI admin (encode/mint, recherche token, vue de l'ensemble des clients), UI client vue client dashaboard des données.
- Indexation : Ponder pour exposer les events (GraphQL).

## Stack
- Solidity, Hardhat, Ethers v6, OpenZeppelin
- Next.js 16, RainbowKit/Wagmi, viem
- Supabase (PostgreSQL)
- Ponder (indexer)
- RPC : Hardhat (localhost), Sepolia (Infura)

## Structure
```
9.Projet Final/
├── backend/                 # Hardhat, contrats, scripts de déploiement, tests
│   ├── contracts/           # PatriDeFi.sol, NftPatriD.sol, MockGoldPriceFeed.sol
│   ├── scripts/             # deploy.ts
│   └── test/                # patri-defi.test.js
├── frontend/                # Next.js (admin/customer, API)
│   ├── src/app/api/         # /customers, /customers/[wallet], /metadata/[id]
│   └── src/components/shared/ # PatriDefiAdmin.tsx, PatriDefiCustomer.tsx
├── ponder/                  # Indexation des events PatriDeFi + NftPatriD
└── README.md
```

## Env (exemples)
`backend/.env.local`  
Définir `BASE_URI` (ex. `http://localhost:3000/api/metadata/` en local ou URL Vercel en prod).

`frontend/.env.local`
```
HARDHAT_RPC_URL=http://localhost:8545
NEXT_PUBLIC_PATRI_DEFI_ADDRESS=<addr PatriDeFi>
NEXT_PUBLIC_PATRI_D_NFT_ADDRESS=<addr NftPatriD>
NEXT_PUBLIC_INFURA_API_KEY=https://sepolia.infura.io/v3/<key>   # ou URL RPC complète
SUPABASE_URL=<url>
SUPABASE_KEY=<publishable>
SUPABASE_SERVICE_ROLE_KEY=<service-role>
NEXT_PUBLIC_WC_PROJECT_ID=<walletconnect project id>            # optionnel
BASE_URI=http://localhost:3000/api/metadata/
```

`ponder/.env`
```
PONDER_NETWORK=localhost
PONDER_RPC_URL_LOCAL=http://127.0.0.1:8545
PATRI_DEFI_ADDRESS_LOCAL=<addr PatriDeFi local>
PATRI_D_NFT_ADDRESS_LOCAL=<addr NftPatriD local>
PONDER_SERVER_PORT=42069
```
(Sepolia : `PONDER_NETWORK=sepolia`, `PONDER_RPC_URL`, `PATRI_DEFI_ADDRESS`, `PATRI_D_NFT_ADDRESS`)

## Lancer en local (Hardhat)
```bash
cd backend
npm install
npx hardhat run scripts/deploy.ts --network localhost

cd ../frontend
npm install
npm run dev   # http://localhost:3000
```

## Déployer (Sepolia / prod)
```bash
cd backend
npx hardhat run scripts/deploy.ts --network sepolia
```
Mettre à jour Vercel : `NEXT_PUBLIC_PATRI_DEFI_ADDRESS`, `NEXT_PUBLIC_PATRI_D_NFT_ADDRESS`, `BASE_URI`, RPC Sepolia, Supabase, etc.

## Indexer (Ponder)
```bash
cd ponder
npm install
rm -rf .ponder
npm run dev   # GraphQL: http://localhost:42069
```

## Tests
```bash
cd backend
npx hardhat test --coverage
No contracts to compile
No Solidity tests to compile

Running Solidity tests



  0 passing

Running Mocha tests


  PatriDeFi / NftPatriD integration (TypeScript)
    ✔ mints ERC1155 to the admin (custody) and stores Supabase reference (642ms)
    ✔ validates inputs and pausable guards (92ms)
    ✔ covers utility paths: quality mapping, base URI, nextTokenId, isCustomer, updateDataHash, feed update (69ms)


  3 passing (804ms)


| Coverage Report                 |        |             |                 |                         |
| ------------------------------- | ------ | ----------- | --------------- | ----------------------- |
| File Path                       | Line % | Statement % | Uncovered Lines | Partially Covered Lines |
| contracts/MockGoldPriceFeed.sol | 100.00 | 100.00      | -               | -                       |
| contracts/NftPatriD.sol         | 100.00 | 100.00      | -               | -                       |
| contracts/PatriDefi.sol         | 98.82  | 94.94       | 109             | 147-149, 207            |
| ------------------------------- | ------ | ----------- | --------------- | ----------------------- |
| Total                           | 99.17  | 96.19       |                 |                         |

```
