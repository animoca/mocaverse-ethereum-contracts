// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import {IRealmId} from "../RealmPoints/interface/IRealmId.sol";
import {IRealmPoints} from "./interface/IRealmPoints.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ContractOwnership} from "@animoca/ethereum-contracts/contracts/access/ContractOwnership.sol";
import {ContractOwnershipStorage} from "@animoca/ethereum-contracts/contracts/access/libraries/ContractOwnershipStorage.sol";

contract SeasonalCumulativeMerkleClaim is ContractOwnership {
    using MerkleProof for bytes32[];
    using ContractOwnershipStorage for ContractOwnershipStorage.Layout;

    IRealmPoints public immutable REALM_POINTS_CONTRACT;

    mapping(bytes32 => bool) public paused;
    mapping(bytes32 => bytes32) public roots;
    mapping(bytes32 => uint256) public nonces;
    mapping(bytes32 => bool) public claimed;

    event Pause(bytes32 season);
    event Unpause(bytes32 season);

    /// @notice Emitted when a new merkle root is set.
    /// @param season The season that the merkle root would be set.
    /// @param root The new merkle root.
    event MerkleRootSet(bytes32 season, bytes32 root);

    /// @notice Emitted when a payout is claimed.
    /// @param season The season of the claim.
    /// @param root The merkle root on which the claim was made.
    /// @param realmId The realmId of the claim.
    /// @param realmIdVersion The version of the realmId.
    /// @param amount The amount of points is claimed.
    /// @param depositReasonCode The deposit reason of the claim.
    /// @param nonce The nonce as when the claim was made.
    event PayoutClaimed(
        bytes32 indexed season,
        bytes32 indexed root,
        uint256 indexed realmId,
        uint256 realmIdVersion,
        uint256 amount,
        bytes32 depositReasonCode,
        uint256 nonce
    );

    /// @notice Thrown when the realm point contract address is invalid.
    /// @param realmPointsContractAddress The address of the invalid realm point contract.
    error InvalidRealmPointsContractAddress(address realmPointsContractAddress);

    /// @notice Thrown when trying to claim the same leaf more than once.
    /// @param season The season of the claim.
    /// @param realmId The realmId of the claim.
    /// @param realmIdVersion The version of the realmId.
    /// @param amount The amount of points is claimed.
    /// @param depositReasonCode The deposit reason of the claim.
    /// @param nonce The nonce as when the claim was made.
    error AlreadyClaimed(bytes32 season, uint256 realmId, uint256 realmIdVersion, uint256 amount, bytes32 depositReasonCode, uint256 nonce);

    /// @notice Thrown when a proof cannot be verified.
    /// @param season The season of the claim.
    /// @param realmId The realmId of the claim.
    /// @param realmIdVersion The version of the realmId.
    /// @param amount The amount of points is claimed.
    /// @param depositReasonCode The deposit reason of the claim.
    /// @param nonce The nonce as when the claim was made.
    error InvalidProof(bytes32 season, uint256 realmId, uint256 realmIdVersion, uint256 amount, bytes32 depositReasonCode, uint256 nonce);

    /// @notice Throws when the season does not exists.
    /// @param season The season of the claim.
    error InvalidSeason(bytes32 season);

    /// @notice Throws when the merkle root does not exist.
    /// @param season The season of the claim.
    error MerkleRootNotExists(bytes32 season);

    /// @notice Throws when the claim amount is zero.
    /// @param amount The amount of the claim.
    error InvalidClaimAmount(uint256 amount);

    /// @notice Throws when the season is paused.
    /// @param season The season that is paused
    error SeasonIsPaused(bytes32 season);

    /// @notice Throws when the season is not paused.
    /// @param season The season that is not paused.
    error SeasonNotPaused(bytes32 season);

    constructor(address realmPointsContractAddress) ContractOwnership(msg.sender) {
        if (realmPointsContractAddress == address(0)) {
            revert InvalidRealmPointsContractAddress(realmPointsContractAddress);
        }
        REALM_POINTS_CONTRACT = IRealmPoints(realmPointsContractAddress);
    }

    /// @notice Pauses a season's claim
    /// @dev Reverts with {NotContractOwner} if the sender is not the contract owner.
    /// @dev Reverts with {SeasonIsPaused} if the season is already paused.
    /// @dev Emits a {Pause} event.
    /// @param season The season to be paused.
    function pause(bytes32 season) external {
        ContractOwnershipStorage.layout().enforceIsContractOwner(msg.sender);
        if (paused[season]) {
            revert SeasonIsPaused(season);
        }

        paused[season] = true;
        emit Pause(season);
    }

    /// @notice Unpause a season's claim
    /// @dev Reverts with {NotContractOwner} if the sender is not the contract owner.
    /// @dev Reverts with {SeasonNotPaused} if the season is not paused.
    /// @dev Emits an {Unpause} event.
    /// @param season The season to be unpaused.
    function unpause(bytes32 season) external {
        ContractOwnershipStorage.layout().enforceIsContractOwner(msg.sender);
        _unpause(season);
    }

    /// @notice Internal function for unpause a season's claim
    /// @dev Reverts with {SeasonNotPaused} if the season is not paused.
    /// @dev Emits an {Unpause} event.
    /// @param season The season to be unpaused.
    function _unpause(bytes32 season) internal {
        if (!paused[season]) {
            revert SeasonNotPaused(season);
        }
        paused[season] = false;
        emit Unpause(season);
    }

    /// @notice Sets the merkle root for a new claiming period and unpauses the season.
    /// @dev Reverts with {NotContractOwner} if the sender is not the contract owner.
    /// @dev Reverts with {SeasonNotPaused} if the season is not paused while applying an update to the root.
    /// @dev Reverts with {InvalidSeason} if the season does not exist.
    /// @dev Emits an {Unpaused} event.
    /// @dev Emits a {MerkleRootSet} event.
    /// @param season The season to be set for th merkle root.
    /// @param merkleRoot The merkle root to set.
    function setMerkleRoot(bytes32 season, bytes32 merkleRoot) public {
        ContractOwnershipStorage.layout().enforceIsContractOwner(msg.sender);

        bool isPaused = paused[season];

        if (roots[season] != 0 && !isPaused) {
            revert SeasonNotPaused(season);
        }
        if (!REALM_POINTS_CONTRACT.seasons(season)) {
            revert InvalidSeason(season);
        }

        roots[season] = merkleRoot;
        unchecked {
            ++nonces[season];
        }
        emit MerkleRootSet(season, merkleRoot);

        if (isPaused) {
            _unpause(season);
        }
    }

    /// @notice Executes the payout for a given realmId (anyone can call this function).
    /// @dev Reverts with {MerkleRootNotExists} if the merkle root does not exist.
    /// @dev Reverts with {SeasonIsPaused} if the contract is paused for that season.
    /// @dev Reverts with {InvalidClaimAmount} if the merkle leaf is storing a zero amount.
    /// @dev Reverts with {AlreadyClaimed} if this specific payout has already been claimed.
    /// @dev Reverts with {InvalidProof} if the merkle proof cannot be verified.
    /// @dev Emits a {PayoutClaimed} event.
    /// @param season The season to be claimed.
    /// @param realmId The realmId for this claim.
    /// @param realmIdVersion The version of the realmId for this claim.
    /// @param amount The amount of points to be claimed.
    /// @param depositReasonCode The deposit reason code for this claim.
    /// @param proof The Merkle proof of the user based on the merkle root
    function claimPayout(
        bytes32 season,
        uint256 realmId,
        uint256 realmIdVersion,
        uint256 amount,
        bytes32 depositReasonCode,
        bytes32[] calldata proof
    ) external {
        if (amount == 0) {
            revert InvalidClaimAmount(amount);
        }
        if (paused[season]) {
            revert SeasonIsPaused(season);
        }
        bytes32 currentRoot = roots[season];
        if (currentRoot == 0) {
            revert MerkleRootNotExists(season);
        }

        uint256 currentNonce = nonces[season];

        bytes32 leaf = keccak256(abi.encodePacked(season, realmId, realmIdVersion, amount, depositReasonCode, currentNonce));

        if (!proof.verifyCalldata(currentRoot, leaf)) {
            revert InvalidProof(season, realmId, realmIdVersion, amount, depositReasonCode, currentNonce);
        }

        if (claimed[leaf]) {
            revert AlreadyClaimed(season, realmId, realmIdVersion, amount, depositReasonCode, currentNonce);
        }

        claimed[leaf] = true;

        REALM_POINTS_CONTRACT.deposit(season, realmId, realmIdVersion, amount, depositReasonCode);

        emit PayoutClaimed(season, currentRoot, realmId, realmIdVersion, amount, depositReasonCode, currentNonce);
    }
}
