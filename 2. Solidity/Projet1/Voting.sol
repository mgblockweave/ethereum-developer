// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.30;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Voting is Ownable {

    /** Structs **/
    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint votedProposalId;
    }

    struct Proposal {
        string description;
        uint voteCount;
    }

    /** Enum **/
    enum WorkflowStatus {
        RegisteringVoters,
        ProposalsRegistrationStarted,
        ProposalsRegistrationEnded,
        VotingSessionStarted,
        VotingSessionEnded,
        VotesTallied
    }

    /**  State **/
    WorkflowStatus public workflowStatus;
    mapping(address => Voter) public voters;
    Proposal[] public proposals;
    uint public winningProposalId;

    /** Events **/
    event VoterRegistered(address indexed voterAddress);
    event WorkflowStatusChange(WorkflowStatus previousStatus, WorkflowStatus newStatus);
    event ProposalRegistered(uint indexed proposalId);
    event Voted(address indexed voter, uint indexed proposalId);

    /** Modifiers **/
    modifier onlyRegistered() {
        require(voters[msg.sender].isRegistered, "Not a registered voter");
        _;
    }

    modifier inStatus(WorkflowStatus status) {
        require(workflowStatus == status, "Function cannot be called at this time");
        _;
    }

    constructor() Ownable(msg.sender) {
        workflowStatus = WorkflowStatus.RegisteringVoters;
    }

    /** Admin functions (owner) **/
    function registerVoter(address _voter) external onlyOwner inStatus(WorkflowStatus.RegisteringVoters) {
        require(!voters[_voter].isRegistered, "Voter already registered");
        voters[_voter] = Voter({isRegistered: true, hasVoted: false, votedProposalId: 0});
        emit VoterRegistered(_voter);
    }

    function startProposalsRegistration() external onlyOwner inStatus(WorkflowStatus.RegisteringVoters) {
        WorkflowStatus previous = workflowStatus;
        workflowStatus = WorkflowStatus.ProposalsRegistrationStarted;
        emit WorkflowStatusChange(previous, workflowStatus);
    }

    function endProposalsRegistration() external onlyOwner inStatus(WorkflowStatus.ProposalsRegistrationStarted) {
        WorkflowStatus previous = workflowStatus;
        workflowStatus = WorkflowStatus.ProposalsRegistrationEnded;
        emit WorkflowStatusChange(previous, workflowStatus);
    }

    function startVotingSession() external onlyOwner inStatus(WorkflowStatus.ProposalsRegistrationEnded) {
        WorkflowStatus previous = workflowStatus;
        workflowStatus = WorkflowStatus.VotingSessionStarted;
        emit WorkflowStatusChange(previous, workflowStatus);
    }

    function endVotingSession() external onlyOwner inStatus(WorkflowStatus.VotingSessionStarted) {
        WorkflowStatus previous = workflowStatus;
        workflowStatus = WorkflowStatus.VotingSessionEnded;
        emit WorkflowStatusChange(previous, workflowStatus);
    }

    function ComputeVotes() external onlyOwner inStatus(WorkflowStatus.VotingSessionEnded) {
        uint winningId = 0;
        uint highestCount = 0;
        for (uint i = 0; i < proposals.length; i++) {
            if (proposals[i].voteCount > highestCount) {
                highestCount = proposals[i].voteCount;
                winningId = i;
            }
        }
        winningProposalId = winningId;
        WorkflowStatus previous = workflowStatus;
        workflowStatus = WorkflowStatus.VotesTallied;
        emit WorkflowStatusChange(previous, workflowStatus);
    }

    /** Voter functions **/
    function addProposal(string calldata _description) external onlyRegistered inStatus(WorkflowStatus.ProposalsRegistrationStarted) {
        require(bytes(_description).length > 0, "Proposal cannot be empty");
        proposals.push(Proposal({description: _description, voteCount: 0}));
        emit ProposalRegistered(proposals.length - 1);
    }

    function vote(uint _proposalId) external onlyRegistered inStatus(WorkflowStatus.VotingSessionStarted) {
        Voter storage sender = voters[msg.sender];
        require(!sender.hasVoted, "Already voted");
        require(_proposalId < proposals.length, "Invalid proposal id");

        sender.hasVoted = true;
        sender.votedProposalId = _proposalId;
        proposals[_proposalId].voteCount += 1;

        emit Voted(msg.sender, _proposalId);
    }

    function getWinner() external view returns (uint _winningProposalId, string memory _description, uint _voteCount) {
        require(workflowStatus == WorkflowStatus.VotesTallied || workflowStatus == WorkflowStatus.VotingSessionEnded, "Winner not available yet");
        uint id = winningProposalId;
        return (id, proposals[id].description, proposals[id].voteCount);
    }

    function getProposalsCount() external view returns (uint) {
        return proposals.length;
    }
}
