import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("VotingModule", (m) => {
  const voting = m.contract("Voting"); 
  // m.call(voting, "startProposalsRegistering");
  return { voting };
});
