import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

//Enum
const WS = {
  RegisteringVoters: 0,
  ProposalsRegistrationStarted: 1,
  ProposalsRegistrationEnded: 2,
  VotingSessionStarted: 3,
  VotingSessionEnded: 4,
  VotesTallied: 5,
} as const;

describe("Voting tests", function () {
  let owner: any, pierre: any, manu: any, ester: any;
  let voting: any;

  const addVoter = async (addr: string) => {
    await expect(voting.addVoter(addr))
      .to.emit(voting, "VoterRegistered")
      .withArgs(addr);
  };

  const startProposals = async () => {
    await expect(voting.startProposalsRegistering())
      .to.emit(voting, "WorkflowStatusChange")
      .withArgs(WS.RegisteringVoters, WS.ProposalsRegistrationStarted);
  };

  const endProposals = async () => {
    await expect(voting.endProposalsRegistering())
      .to.emit(voting, "WorkflowStatusChange")
      .withArgs(WS.ProposalsRegistrationStarted, WS.ProposalsRegistrationEnded);
  };

  const startVoting = async () => {
    await expect(voting.startVotingSession())
      .to.emit(voting, "WorkflowStatusChange")
      .withArgs(WS.ProposalsRegistrationEnded, WS.VotingSessionStarted);
  };

  const endVoting = async () => {
    await expect(voting.endVotingSession())
      .to.emit(voting, "WorkflowStatusChange")
      .withArgs(WS.VotingSessionStarted, WS.VotingSessionEnded);
  };

  beforeEach(async () => {
    [owner, pierre, manu, ester] = await ethers.getSigners();
    const Voting = await ethers.getContractFactory("Voting", owner);
    voting = await Voting.deploy();
    await voting.waitForDeployment();
  });

  it("start owner = deployer & status = RegisteringVoters", async () => {
    expect(await voting.owner()).to.equal(await owner.getAddress());
    expect(await voting.workflowStatus()).to.equal(WS.RegisteringVoters);
  });

  it("addVoter onlyOwner + event + no double registrations", async () => {
    await expect(voting.connect(pierre).addVoter(await manu.getAddress()))
      .to.be.revertedWithCustomError(voting, "OwnableUnauthorizedAccount")
      .withArgs(await pierre.getAddress());

    await expect(voting.addVoter(await pierre.getAddress()))
      .to.emit(voting, "VoterRegistered")
      .withArgs(await pierre.getAddress());

    await expect(voting.addVoter(await pierre.getAddress()))
      .to.be.revertedWith("Already registered");

    await startProposals();
    await expect(voting.addVoter(await manu.getAddress()))
      .to.be.revertedWith("Voters registration is not open yet");
  });


  it("getters onlyVoters", async () => {
    await addVoter(await pierre.getAddress());

    const v = await voting.connect(pierre).getVoter(await pierre.getAddress());
    expect(v.isRegistered).to.equal(true);
    expect(v.hasVoted).to.equal(false);

    await expect(
      voting.connect(manu).getVoter(await pierre.getAddress())
    ).to.be.revertedWith("You're not a voter");
  });

  it("startProposals add new GENESIS + empty blocked + event ProposalRegistered", async () => {
    await addVoter(await pierre.getAddress());

    await expect(
      voting.connect(pierre).addProposal("P1")
    ).to.be.revertedWith("Proposals are not allowed yet");

    await startProposals();

    await expect(
      voting.connect(pierre).addProposal("")
    ).to.be.revertedWith("Vous ne pouvez pas ne rien proposer");

    // GENESIS 
    await expect(voting.connect(pierre).addProposal("P1"))
      .to.emit(voting, "ProposalRegistered")
      .withArgs(1);

    const proposition0 = await voting.connect(pierre).getOneProposal(0);
    expect(proposition0.description).to.equal("GENESIS");
    const proposition1 = await voting.connect(pierre).getOneProposal(1);
    expect(proposition1.description).to.equal("P1");
  });

  it("vote proposal not found + no double voted + event", async () => {
    await addVoter(await pierre.getAddress());
    await addVoter(await manu.getAddress());

    await startProposals();
    await voting.connect(pierre).addProposal("A"); // id 1
    await endProposals();
    await startVoting();

    await expect(voting.connect(pierre).setVote(10)).to.be.revertedWith(
      "Proposal not found"
    );

    // vote ok + event
    await expect(voting.connect(pierre).setVote(1))
      .to.emit(voting, "Voted")
      .withArgs(await pierre.getAddress(), 1);

    // double vote
    await expect(voting.connect(pierre).setVote(1)).to.be.revertedWith(
      "You have already voted"
    );
  });

  it("tallyVotes expect winner", async () => {
    await addVoter(await pierre.getAddress());
    await addVoter(await manu.getAddress());
    await addVoter(await ester.getAddress());

    await startProposals();
    await voting.connect(pierre).addProposal("A"); 
    await voting.connect(manu).addProposal("B");   
    await endProposals();
    await startVoting();

    await voting.connect(pierre).setVote(2); // B
    await voting.connect(manu).setVote(2);   // B
    await voting.connect(ester).setVote(1); // A

    await endVoting();

    await expect(voting.tallyVotes())
      .to.emit(voting, "WorkflowStatusChange")
      .withArgs(WS.VotingSessionEnded, WS.VotesTallied);

    expect(await voting.winningProposalID()).to.equal(2); // "B"
    expect(await voting.workflowStatus()).to.equal(WS.VotesTallied);
  });

  it("setVote session not started", async () => {
    await addVoter(await pierre.getAddress());
    await expect(voting.connect(pierre).setVote(0)).to.be.revertedWith(
      "Voting session havent started yet"
    );
  });
});
