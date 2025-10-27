Voting Unit Tests

Implémentation des units tests pour le smart contract `Voting.sol` (version de correction).  
Les tests couvrent les scénarios réussis (events attendus) et les scénarios d’échec (reverts explicites).

---



- Node 18+
- Hardhat **v3**
- Ethers 
- TypeScript pour les tests 

---

Stucture 

.
├─ contracts/
│ └─ Voting.sol
├─ test/
│ └─ Voting.ts
├─ hardhat.config.ts
├─ tsconfig.json
└─ package.json

---
npm i
npx hardhat compile
npx hardhat test