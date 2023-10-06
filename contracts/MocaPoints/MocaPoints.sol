// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IRealmId} from "./interface/IRealmId.sol";
import {AccessControlStorage} from "@animoca/ethereum-contracts/contracts/access/libraries/AccessControlStorage.sol";
import {AccessControlBase} from "@animoca/ethereum-contracts/contracts/access/base/AccessControlBase.sol";
import {ContractOwnershipBase} from "@animoca/ethereum-contracts/contracts/access/base/ContractOwnershipBase.sol";
import {ContractOwnershipStorage} from "@animoca/ethereum-contracts/contracts/access/libraries/ContractOwnershipStorage.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title MocaPoints
/// @notice This contract is designed for managing the mocapoints balances of users.
/// @notice Mocapoints balances are registered by realmId (verioned) by season.
/// @notice Methods apply to the current version of the realmId if realmId version is not specified.
/// @notice Methods support identifying the realmId by the realmId itself, or by its parent node and name.
contract MocaPoints is Initializable, AccessControlBase, ContractOwnershipBase, UUPSUpgradeable {
    using ContractOwnershipStorage for ContractOwnershipStorage.Layout;
    using AccessControlStorage for AccessControlStorage.Layout;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    bytes32 public currentSeason;
    mapping(bytes32 => bool) public seasons;

    IRealmId public realmIdContract;

    mapping(bytes32 => mapping(uint256 => mapping(uint256 => uint256))) public balances; // season => realmId => realmIdVersion => balance

    mapping(uint256 => uint256) public nonces; // realmId => nonce

    mapping(bytes32 => bool) public allowedConsumeReasonCodes;

    /// @notice Emitted when the current season is set.
    /// @param season The new season being set.
    event SetCurrentSeason(bytes32 season);

    /// @notice Emitted when one or more reason code(s) are added to the comsume reason code mapping.
    /// @param reasonCodes The reason codes added to the mapping.
    event BatchAddedConsumeReasonCode(bytes32[] reasonCodes);

    /// @notice Emitted when one or more reason code(s) are removed from the comsume reason code mapping.
    /// @param reasonCodes The reason codes removed from the mapping.
    event BatchRemovedConsumeReasonCode(bytes32[] reasonCodes);

    /// @notice Emitted when an amount is deposited to a balance.
    /// @param sender The sender of the deposit.
    /// @param season The season of the balance deposited to.
    /// @param reasonCode The reason code of the deposit.
    /// @param realmId The realmId of the balance deposited to. 
    /// @param realmIdVersion The realmId version.
    /// @param amount The amount deposited.
    event Deposited(
        address indexed sender,
        bytes32 indexed season,
        bytes32 indexed reasonCode,
        uint256 realmId,
        uint256 realmIdVersion,
        uint256 amount
    );

    /// @notice Emitted when an amount is consumed from a balance.
    /// @param realmId The realmId of the balance consumed from. 
    /// @param season The season of the balance consumed from.
    /// @param reasonCode The reason code of the consumption.
    /// @param operator The sender of the consumption.
    /// @param realmIdVersion The realmId version.
    /// @param amount The amount consumed.
    /// @param realmIdOwner The realmId owner's address.
    event Consumed(
        uint256 indexed realmId,
        bytes32 indexed season,
        bytes32 indexed reasonCode,
        address operator,
        uint256 realmIdVersion,
        uint256 amount,
        address realmIdOwner
    );

    /// @notice Initializes the contract with the provided realmId contract address.
    /// @dev Reverts if the given address is invalid (equal to ZeroAddress).
    /// @param _realmIdContract The realmId contract address.
    function initialize(address _realmIdContract) public initializer {
        __UUPSUpgradeable_init();
        require(_realmIdContract != address(0), "Not a valid Contract Address");
        ContractOwnershipStorage.layout().proxyInit(_msgSender());
        realmIdContract = IRealmId(_realmIdContract);
    }

    /// @notice Checks whether the sender is authorized to upgrade the contract.
    /// @dev Reverts if sender is not the contract owner.
    function _authorizeUpgrade(address) internal view override {
        ContractOwnershipStorage.layout().enforceIsContractOwner(_msgSender());
    }

    /// @notice Sets the current season.
    /// @dev Reverts if sender does not have Admin role.
    /// @dev Reverts if the given season has already been set before.
    /// @dev Emits a {SetCurrentSeason} event if successful.
    /// @param _season The season to set.
    function setCurrentSeason(bytes32 _season) external {
        AccessControlStorage.layout().enforceHasRole(ADMIN_ROLE, _msgSender());
        require(!seasons[_season], "Season already set");
        currentSeason = _season;
        seasons[_season] = true;
        emit SetCurrentSeason(_season);
    }

    /// @notice Adds one or more reason code(s) to the consume reason code mapping.
    /// @dev Reverts if sender does not have Admin role.
    /// @dev Reverts if the given reason codes array is empty.
    /// @dev Reverts if any of the given reason codes already exists in the mapping.
    /// @dev Emits a {BatchAddedConsumeReasonCode} event if all the given reason codes are successfully added.
    /// @param _reasonCodes Array of reason codes to add.
    function batchAddConsumeReasonCodes(bytes32[] memory _reasonCodes) public {
        AccessControlStorage.layout().enforceHasRole(ADMIN_ROLE, _msgSender());
        require(_reasonCodes.length > 0, "Empty Reason codes array");
        for (uint256 i = 0; i < _reasonCodes.length; i++) {
            require(!allowedConsumeReasonCodes[_reasonCodes[i]], "Reason code already exists");
            allowedConsumeReasonCodes[_reasonCodes[i]] = true;
        }
        emit BatchAddedConsumeReasonCode(_reasonCodes);
    }

    /// @notice Removes one or more reason code(s) from the consume reason code mapping.
    /// @dev Reverts if sender does not have Admin role.
    /// @dev Reverts if the given reason codes array is empty.
    /// @dev Reverts if any of the given reason codes do not exist in the mapping.
    /// @dev Emits a {BatchRemovedConsumeReasonCode} event if all the given reason codes are successfully removed.
    /// @param _reasonCodes Array of reason codes to remove.
    function batchRemoveConsumeReasonCodes(bytes32[] memory _reasonCodes) public {
        AccessControlStorage.layout().enforceHasRole(ADMIN_ROLE, _msgSender());
        require(_reasonCodes.length > 0, "Empty Reason codes array ");
        for (uint256 i = 0; i < _reasonCodes.length; i++) {
            require(allowedConsumeReasonCodes[_reasonCodes[i]], "Reason code does not exist");
            delete allowedConsumeReasonCodes[_reasonCodes[i]];
        }
        emit BatchRemovedConsumeReasonCode(_reasonCodes);
    }

    /// @notice Called by a depoistor to increase the balance of a realmId (with a given version) for a specified season.
    /// @dev Reverts if sender does not have Depositor role.
    /// @dev Emits a {Deposited} event if successful.
    /// @param season The season to deposit to.
    /// @param realmId The realmId to deposit to.
    /// @param realmIdVersion The realmId version.
    /// @param amount The amount to deposit.
    /// @param depositReasonCode The reason code of the deposit.
    function deposit(bytes32 season, uint256 realmId, uint256 realmIdVersion, uint256 amount, bytes32 depositReasonCode) public {
        AccessControlStorage.layout().enforceHasRole(DEPOSITOR_ROLE, _msgSender());

        balances[season][realmId][realmIdVersion] += amount;
        emit Deposited(_msgSender(), season, depositReasonCode, realmId, realmIdVersion, amount);
    }

    /// @notice Called by a depoistor to increase the balance of a realmId (with a given version) for a specified season.
    /// @notice The realmId is resolved from the given parent node and name.
    /// @dev Reverts if sender does not have Depositor role.
    /// @dev Emits a {Deposited} event with msg.sender as the sender.
    /// @param season The season to deposit to.
    /// @param parentNode The parent node associated with the realmId.
    /// @param name The name associated with the realmId.
    /// @param realmIdVersion The realmId version.
    /// @param amount The amount to deposit.
    /// @param depositReasonCode The reason code of the deposit.
    function deposit(
        bytes32 season,
        bytes32 parentNode,
        string memory name,
        uint256 realmIdVersion,
        uint256 amount,
        bytes32 depositReasonCode
    ) public {
        uint256 realmId = realmIdContract.getTokenId(name, parentNode);
        deposit(season, realmId, realmIdVersion, amount, depositReasonCode);
    }

    /// @notice Called by other public functions to consume a given amount from the balance of a given realmId and version.
    /// @notice Applies to the current season.
    /// @dev Reverts if balance is insufficient.
    /// @dev Reverts if the consume reason code is not allowed.
    /// @dev Emits a {Consumed} event if the consumption is successful.
    /// @param realmId The realmId to deposit to.
    /// @param realmIdVersion The realmId version.
    /// @param amount The amount to consume.
    /// @param consumeReasonCode The reason code of the consumption.
    /// @param owner_ Address of the realmId's owner.
    function _consume(uint256 realmId, uint256 realmIdVersion, uint256 amount, bytes32 consumeReasonCode, address owner_) internal {
        // Check if the sender has enough balance
        require(balances[currentSeason][realmId][realmIdVersion] >= amount, "Insufficient balance");
        // Check if the consumeReasonCode exists and is true in the mapping
        require(allowedConsumeReasonCodes[consumeReasonCode], "Invalid consume reason code");

        balances[currentSeason][realmId][realmIdVersion] -= amount;

        emit Consumed(realmId, currentSeason, consumeReasonCode, _msgSender(), realmIdVersion, amount, owner_);
        nonces[realmId]++;
    }

    /// @notice Called with a signature to consume a given amount from the balance of a realmId.
    /// @notice The realmId is resolved from the given parent node and name.
    /// @notice Applies to the current version of the realmId.
    /// @notice Applies to the current season.
    /// @dev Reverts if fails to resolve realmId from the given parent node and name.
    /// @dev Reverts if fails to resolve realmId's version.
    /// @dev Reverts if signature is invalid.
    /// @dev Reverts if fails to resolve owner of the realmId.
    /// @dev Reverts if signer is not the realmId owner.
    /// @dev Reverts if balance is insufficient.
    /// @dev Reverts if the consume reason code is not allowed.
    /// @dev Emits a {Consumed} event if the consumption is successful.
    /// @param parentNode The parent node of the realmId.
    /// @param _name The name of the realmId.
    /// @param amount The amount to consume.
    /// @param consumeReasonCode The reason code of the consumption.
    /// @param v v value of the signature.
    /// @param s s value of the signature.
    /// @param r r value of the signature.
    function consume(bytes32 parentNode, string memory _name, uint256 amount, bytes32 consumeReasonCode, uint8 v, bytes32 r, bytes32 s) public {
        uint256 realmId = realmIdContract.getTokenId(_name, parentNode);
        consume(realmId, amount, consumeReasonCode, v, r, s);
    }

    /// @notice Called with a signature to consume a given amount from the balance of a given realmId.
    /// @notice Applies to the current version of the realmId.
    /// @notice Applies to the current season.
    /// @dev Reverts if failes to resolve realmId's version.
    /// @dev Reverts if signature is invalid.
    /// @dev Reverts if fails to resolve owner of the realmId.
    /// @dev Reverts if signer is not the realmId owner.
    /// @dev Reverts if balance is insufficient.
    /// @dev Reverts if the consume reason code is not allowed.
    /// @dev Emits a {Consumed} event if the consumption is successful.
    /// @param realmId The realmId to consume from.
    /// @param amount The amount to consume.
    /// @param consumeReasonCode The reason code of the consumption.
    /// @param v v value of the signature.
    /// @param s s value of the signature.
    /// @param r r value of the signature.
    function consume(uint256 realmId, uint256 amount, bytes32 consumeReasonCode, uint8 v, bytes32 r, bytes32 s) public {
        // get realmIdVersion from the realmId contract
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        bytes32 _messageHash = _preparePayload(realmId, realmIdVersion, amount, nonces[realmId], consumeReasonCode);
        bytes32 messageDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash));
        address signer = ecrecover(messageDigest, v, r, s);
        address owner_ = realmIdContract.ownerOf(realmId);
        require(signer == owner_, "Signer is not the owner");
        _consume(realmId, realmIdVersion, amount, consumeReasonCode, owner_);
    }

    /// @notice Called by the realmId owner to consume a given amount from the realmId's balance.
    /// @notice The realmId is resolved from the given parent node and name.
    /// @notice Applies to the current version of the realmId.
    /// @notice Applies to the current season.
    /// @dev Reverts if fails to resolve realmId from the given parent node and name.
    /// @dev Reverts if fails to resolve owner of the realmId.
    /// @dev Reverts if the sender is not the owner of the realmId.
    /// @dev Reverts if fails to resolve realmId's version.
    /// @dev Reverts if balance is insufficient.
    /// @dev Reverts if the consume reason code is not allowed.
    /// @dev Emits a {Consumed} event if the consumption is successful.
    /// @param parentNode The parent node of the realmId.
    /// @param _name The name of the realmId.
    /// @param amount The amount to consume.
    /// @param consumeReasonCode The reason code of the consumption.
    function consume(bytes32 parentNode, string memory _name, uint256 amount, bytes32 consumeReasonCode) public {
        uint256 realmId = realmIdContract.getTokenId(_name, parentNode);
        consume(realmId, amount, consumeReasonCode);
    }

    /// @notice Called by the realmId owner to consume a given amount from the given realmId's balance.
    /// @notice Applies to the current version of the realmId.
    /// @notice Applies to the current season.
    /// @dev Reverts if fails to resolve owner of the realmId.
    /// @dev Reverts if the sender is not the owner of the realmId.
    /// @dev Reverts if fails to resolve realmId's version.
    /// @dev Reverts if balance is insufficient.
    /// @dev Reverts if the consume reason code is not allowed.
    /// @dev Emits a {Consumed} event if the consumption is successful.
    /// @param realmId The realmId to deposit to.
    /// @param amount The amount to consume.
    /// @param consumeReasonCode The reason code of the consumption.
    function consume(uint256 realmId, uint256 amount, bytes32 consumeReasonCode) public {
        address owner_ = realmIdContract.ownerOf(realmId);
        require(_msgSender() == owner_, "Sender is not the owner");

        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        _consume(realmId, realmIdVersion, amount, consumeReasonCode, _msgSender());
    }

    /// @notice Gets the balance of a given realmId for a specified season.
    /// @notice Applies to the current version of the realmId.
    /// @dev Reverts if fails to resolve realmId's version.
    /// @param season The season.
    /// @param realmId The realmId.
    function balanceOf(bytes32 season, uint256 realmId) external view returns (uint256) {
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        return balances[season][realmId][realmIdVersion];
    }

    /// @notice Gets the balance of a realmId for a specified season.
    /// @notice The realmId is resolved from the given parent node and name.
    /// @notice Applies to the current version of the realmId.
    /// @dev Reverts if fails to resolve realmId from the given parent node and name.
    /// @dev Reverts if fails to resolve realmId's version.
    /// @param season The season.
    /// @param parentNode The parent node of the realmId.
    /// @param _name The name of the realmId.
    function balanceOf(bytes32 season, bytes32 parentNode, string memory _name) external view returns (uint256) {
        uint256 realmId = realmIdContract.getTokenId(_name, parentNode);
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        return balances[season][realmId][realmIdVersion];
    }

    /// @notice Gets the balance of a given realmId.
    /// @notice Applies to the current version of the realmId.
    /// @notice Applies to the current season.
    /// @dev Reverts if fails to resolve realmId's version.
    /// @param realmId The realmId.
    function balanceOf(uint256 realmId) external view returns (uint256) {
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        return balances[currentSeason][realmId][realmIdVersion];
    }

    /// @notice Gets the balance of a realmId.
    /// @notice The realmId is resolved from the given parent node and name.
    /// @notice Applies to the current version of the realmId.
    /// @notice Applies to the current season.
    /// @dev Reverts if fails to resolve realmId from the given parent node and name.
    /// @dev Reverts if fails to resolve realmId's version.
    /// @param parentNode The parent node of the realmId.
    /// @param _name The name of the realmId.
    function balanceOf(bytes32 parentNode, string memory _name) external view returns (uint256) {
        uint256 realmId = realmIdContract.getTokenId(_name, parentNode);
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        return balances[currentSeason][realmId][realmIdVersion];
    }

    /// @notice Returns a payload generated from the arguments and the current season.
    /// @param realmId The realmId.
    /// @param realmIdVersion The realmId version.
    /// @param amount The amount.
    /// @param nonce The nonce.
    /// @param reasonCode The reason code.
    function _preparePayload(
        uint256 realmId,
        uint256 realmIdVersion,
        uint256 amount,
        uint256 nonce,
        bytes32 reasonCode
    ) internal view returns (bytes32) {
        bytes32 payload = keccak256(abi.encodePacked(realmId, realmIdVersion, amount, currentSeason, reasonCode, nonce));
        return payload;
    }

    /// @notice Returns a payload generated from the arguments, current nounce, current season and the given realmId's current version.
    /// @dev Reverts if fails to resolve the realmId's version.
    /// @param realmId The realmId.
    /// @param amount The amount.
    /// @param reasonCode The reason code.
    function preparePayload(uint256 realmId, uint256 amount, bytes32 reasonCode) public view returns (bytes32) {
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        bytes32 payload = _preparePayload(realmId, realmIdVersion, amount, nonces[realmId], reasonCode);
        return payload;
    }
}
