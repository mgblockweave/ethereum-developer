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

    /** State **/
    WorkflowStatus public workflowStatus;
    mapping(address => Voter) public voters;
    Proposal[] public proposals;
    uint public winningProposalId;
    uint public registeredVotersCount; //to validate the starting session

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
    function registerVoter(address _voter)
        external
        onlyOwner
        inStatus(WorkflowStatus.RegisteringVoters)
    {
        require(_voter != owner(), "Admin must use registerAdminAsVoter"); //to force the admin to pass to the specific function
        require(!voters[_voter].isRegistered, "Voter already registered");
        voters[_voter] = Voter({isRegistered: true, hasVoted: false, votedProposalId: 0});
        registeredVotersCount += 1; //add the voter count
        emit VoterRegistered(_voter);
    }

    function registerAdminAsVoter() 
        external
        onlyOwner
        inStatus(WorkflowStatus.RegisteringVoters)
    {
        require(!voters[owner()].isRegistered, "Admin already registered");
        voters[owner()] = Voter({isRegistered: true, hasVoted: false, votedProposalId: 0});
        registeredVotersCount += 1;
        emit VoterRegistered(owner());
    }

    function startProposalsRegistration()
        external
        onlyOwner
        inStatus(WorkflowStatus.RegisteringVoters)
    {
        require(registeredVotersCount > 0, "No registered voters"); //check if there are voters
        WorkflowStatus previous = workflowStatus;
        workflowStatus = WorkflowStatus.ProposalsRegistrationStarted;
        emit WorkflowStatusChange(previous, workflowStatus);
    }

    function endProposalsRegistration()
        external
        onlyOwner
        inStatus(WorkflowStatus.ProposalsRegistrationStarted)
    {
        WorkflowStatus previous = workflowStatus;
        workflowStatus = WorkflowStatus.ProposalsRegistrationEnded;
        emit WorkflowStatusChange(previous, workflowStatus);
    }

    function startVotingSession()
        external
        onlyOwner
        inStatus(WorkflowStatus.ProposalsRegistrationEnded)
    {
        require(proposals.length > 0, "No proposals"); //check if there was proposal submitted
        WorkflowStatus previous = workflowStatus;
        workflowStatus = WorkflowStatus.VotingSessionStarted;
        emit WorkflowStatusChange(previous, workflowStatus);
    }

    function endVotingSession()
        external
        onlyOwner
        inStatus(WorkflowStatus.VotingSessionStarted)
    {
        WorkflowStatus previous = workflowStatus;
        workflowStatus = WorkflowStatus.VotingSessionEnded;
        emit WorkflowStatusChange(previous, workflowStatus);
    }

    function ComputeVotes()
        external
        onlyOwner
        inStatus(WorkflowStatus.VotingSessionEnded)
    {
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
    function addProposal(string calldata _description)
        external
        onlyRegistered
        inStatus(WorkflowStatus.ProposalsRegistrationStarted)
    {
        require(bytes(_description).length > 0, "Proposal cannot be empty");

        for (uint i = 0; i < proposals.length; i++) {
            // Compare if proposation has already been made
            if (
                keccak256(bytes(proposals[i].description)) ==
                keccak256(bytes(_description))
            ) {
                revert("Proposal already exists");
            }
        }
        proposals.push(Proposal({description: _description, voteCount: 0}));
        emit ProposalRegistered(proposals.length - 1);
    }

    function vote(uint _proposalId)
        external
        onlyRegistered
        inStatus(WorkflowStatus.VotingSessionStarted)
    {
        Voter storage sender = voters[msg.sender];
        require(!sender.hasVoted, "Already voted");
        require(_proposalId < proposals.length, "Invalid proposal id");

        sender.hasVoted = true;
        sender.votedProposalId = _proposalId;
        proposals[_proposalId].voteCount += 1;

        emit Voted(msg.sender, _proposalId);
    }

    function getWinner()
        external
        view
        returns (uint _winningProposalId, string memory _description, uint _voteCount)
    {
        require(
            workflowStatus == WorkflowStatus.VotesTallied ||
            workflowStatus == WorkflowStatus.VotingSessionEnded,
            "Winner not available yet"
        );
        uint id = winningProposalId;
        return (id, proposals[id].description, proposals[id].voteCount);
    }

    function getProposalsCount() external view returns (uint) {
        return proposals.length;
    }
}
