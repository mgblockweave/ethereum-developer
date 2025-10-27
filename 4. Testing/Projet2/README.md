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

---

Results :
Projet2 % npx hardhat test
Nothing to compile
Nothing to compile

Running Solidity tests



  0 passing

Running Mocha tests


  Voting tests
    ✔ start owner = deployer & status = RegisteringVoters
    ✔ addVoter onlyOwner + event + no double registrations
    ✔ getters onlyVoters
    ✔ startProposals add new GENESIS + empty blocked + event ProposalRegistered
    ✔ vote proposal not found + no double voted + event
    ✔ tallyVotes expect winner
    ✔ setVote session not started


  7 passing (136ms)