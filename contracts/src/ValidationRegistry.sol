// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";
import {Ownable2Step} from "openzeppelin-contracts/access/Ownable2Step.sol";
import {AccessControl} from "openzeppelin-contracts/access/AccessControl.sol";

/**
 * @title ValidationRegistry
 * @notice Stores cryptographic proofs and validation records for agent executions.
 * Critical for reputation updates and governance in the hybrid human/AI DAO.
 */
contract ValidationRegistry is Ownable2Step, AccessControl {
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    struct ValidationProof {
        address validator;
        uint256 timestamp;
        bytes32 proofHash; // e.g., keccak of execution trace + result
        string validationType; // "execution", "vote", "proposal"
        bool isValid;
    }

    mapping(bytes32 => ValidationProof) public proofs; // proofId => Proof
    mapping(address => uint256) public validationCounts;
    
    event ProofStored(bytes32 indexed proofId, address indexed validator, bytes32 proofHash, string validationType);
    event ValidationUpdated(bytes32 indexed proofId, bool isValid);

    error ProofAlreadyExists();
    error InvalidProof();
    error UnauthorizedValidator();

    constructor(address initialOwner) Ownable(initialOwner) Ownable2Step() {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(VALIDATOR_ROLE, initialOwner);
    }

    /**
     * @notice Stores a validation proof for an agent's execution
     * @param proofId Unique identifier for the execution (e.g., hash of task + params)
     * @param proofHash Cryptographic hash of execution details
     * @param validationType Type of validation performed
     * @return success Whether proof was stored successfully
     */
    function storeProof(
        bytes32 proofId,
        bytes32 proofHash,
        string calldata validationType
    ) external onlyRole(VALIDATOR_ROLE) returns (bool) {
        if (proofs[proofId].timestamp != 0) revert ProofAlreadyExists();
        if (proofHash == bytes32(0)) revert InvalidProof();

        proofs[proofId] = ValidationProof({
            validator: msg.sender,
            timestamp: block.timestamp,
            proofHash: proofHash,
            validationType: validationType,
            isValid: true
        });
        
        validationCounts[msg.sender]++;
        emit ProofStored(proofId, msg.sender, proofHash, validationType);
        return true;
    }

    function getProof(bytes32 proofId) external view returns (ValidationProof memory) {
        return proofs[proofId];
    }

    function markInvalid(bytes32 proofId) external onlyRole(VALIDATOR_ROLE) {
        if (proofs[proofId].timestamp == 0) revert InvalidProof();
        proofs[proofId].isValid = false;
        emit ValidationUpdated(proofId, false);
    }

    function verifyProof(bytes32 proofId, bytes32 expectedHash) external view returns (bool) {
        ValidationProof memory proof = proofs[proofId];
        return proof.isValid && proof.proofHash == expectedHash && proof.timestamp != 0;
    }
}