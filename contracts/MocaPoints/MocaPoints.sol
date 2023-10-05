// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IRealmId} from "./interface/IRealmId.sol";
import {AccessControlStorage} from "@animoca/ethereum-contracts/contracts/access/libraries/AccessControlStorage.sol";
import {AccessControlBase} from "@animoca/ethereum-contracts/contracts/access/base/AccessControlBase.sol";
import {ContractOwnershipBase} from "@animoca/ethereum-contracts/contracts/access/base/ContractOwnershipBase.sol";
import {ContractOwnershipStorage} from "@animoca/ethereum-contracts/contracts/access/libraries/ContractOwnershipStorage.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract MocaPoints is Initializable, AccessControlBase, ContractOwnershipBase, UUPSUpgradeable {
    using ContractOwnershipStorage for ContractOwnershipStorage.Layout;
    using AccessControlStorage for AccessControlStorage.Layout;

    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    // Seasonal variables
    bytes32 public currentSeason;
    mapping(bytes32 => bool) public seasons;

    // RealmId contract
    IRealmId public realmIdContract;

    // Balances mapping
    mapping(bytes32 => mapping(uint256 => mapping(uint256 => uint256))) public balances; // season => realmId => realmIdVersion => balance

    // Nonce management
    mapping(uint256 => uint256) public nonces; // realmId => nonce

    // Allowed consume reason codes mapping
    mapping(bytes32 => bool) public allowedConsumeReasonCodes;

    event SetCurrentSeason(bytes32 season);
    event BatchAddedConsumeReasonCode(bytes32[] reasonCodes);
    event BatchRemovedConsumeReasonCode(bytes32[] reasonCodes);
    event Deposited(
        address indexed sender,
        bytes32 indexed season,
        bytes32 indexed reasonCode,
        uint256 realmId,
        uint256 realmIdVersion,
        uint256 amount
    );

    event Consumed(
        uint256 indexed realmId,
        bytes32 indexed season,
        bytes32 indexed reasonCode,
        address operator,
        uint256 realmIdVersion,
        uint256 amount,
        address realmIdOwner
    );

    // Initializes the contract with the provided `_realmIdContract` address.
    // Ensures that `_realmIdContract`are valid addresses and not equal to ZeroAddress.
    function initialize(address _realmIdContract) public initializer {
        __UUPSUpgradeable_init();
        require(_realmIdContract != address(0), "Not a valid Contract Address");
        ContractOwnershipStorage.layout().proxyInit(_msgSender());
        realmIdContract = IRealmId(_realmIdContract);
    }

    // Checks whether the sender is authorized to upgrade the contract.
    // Only the contract owner is allowed to authorize upgrades.
    function _authorizeUpgrade(address) internal view override {
        ContractOwnershipStorage.layout().enforceIsContractOwner(_msgSender());
    }

    //Revert if sender does not have Admin role
    //Revert if the given season already exists
    //Emits a {SetCurrentSeason} event if the new season is different from the old season
    function setCurrentSeason(bytes32 _season) external {
        AccessControlStorage.layout().enforceHasRole(ADMIN_ROLE, _msgSender());
        require(!seasons[_season], "Season already set");
        currentSeason = _season;
        seasons[_season] = true;
        emit SetCurrentSeason(_season);
    }

    // Reverts if the sender does not have the Admin role.
    // Check array lengths of reasonCodes
    // Reverts if any of the reason codes already exists.
    // Emits a {BatchAddedConsumeReasonCode} event if all the reason codes are set to the consume reason code mapping.
    function batchAddConsumeReasonCodes(bytes32[] memory _reasonCodes) public {
        AccessControlStorage.layout().enforceHasRole(ADMIN_ROLE, _msgSender());
        require(_reasonCodes.length > 0, "Empty Reason codes array");
        for (uint256 i = 0; i < _reasonCodes.length; i++) {
            require(!allowedConsumeReasonCodes[_reasonCodes[i]], "Reason code already exists");
            allowedConsumeReasonCodes[_reasonCodes[i]] = true;
        }
        emit BatchAddedConsumeReasonCode(_reasonCodes);
    }

    // Reverts if the sender does not have the Admin role.
    // Check array lengths of reasonCodes
    // Reverts if any of the reason codes do not exist.
    // Emits a {BatchRemovedConsumeReasonCode} event if all the given reason codes can be set to false.
    function batchRemoveConsumeReasonCodes(bytes32[] memory _reasonCodes) public {
        AccessControlStorage.layout().enforceHasRole(ADMIN_ROLE, _msgSender());
        require(_reasonCodes.length > 0, "Empty Reason codes array ");
        for (uint256 i = 0; i < _reasonCodes.length; i++) {
            require(allowedConsumeReasonCodes[_reasonCodes[i]], "Reason code does not exist");
            delete allowedConsumeReasonCodes[_reasonCodes[i]];
        }
        emit BatchRemovedConsumeReasonCode(_reasonCodes);
    }

    // Reverts if the sender does not have Depositor role
    // increase balance
    // Emits a {Deposited} event with sender set to msg.sender
    function deposit(bytes32 season, uint256 realmId, uint256 realmIdVersion, uint256 amount, bytes32 depositReasonCode) public {
        AccessControlStorage.layout().enforceHasRole(DEPOSITOR_ROLE, _msgSender());

        balances[season][realmId][realmIdVersion] += amount;
        emit Deposited(_msgSender(), season, depositReasonCode, realmId, realmIdVersion, amount);
    }

    // Reverts if the sender does not have Depositor role
    // increase balance
    // Emits a {Deposited} event with sender set to msg.sender
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

    function _consume(uint256 realmId, uint256 realmIdVersion, uint256 amount, bytes32 consumeReasonCode, address owner_) internal {
        // Check if the sender has enough balance
        require(balances[currentSeason][realmId][realmIdVersion] >= amount, "Insufficient balance");
        // Check if the consumeReasonCode exists and is true in the mapping
        require(allowedConsumeReasonCodes[consumeReasonCode], "Invalid consume reason code");

        balances[currentSeason][realmId][realmIdVersion] -= amount;

        emit Consumed(realmId, currentSeason, consumeReasonCode, _msgSender(), realmIdVersion, amount, owner_);
        nonces[realmId]++;
    }

    // Reverts if the signature format is not correct (realmId, realmIdVersion, amount, currentSeason, reasonCode, nonce)
    // Reverts if the signer is not the realmId owner
    // Reverts if the signer does not have enough balance
    // Reverts if the consumeReasonCodes does not exist or the value is false in the mapping
    // Emits a {Consumed} event
    function consume(bytes32 parentNode, string memory _name, uint256 amount, bytes32 consumeReasonCode, uint8 v, bytes32 r, bytes32 s) public {
        uint256 realmId = realmIdContract.getTokenId(_name, parentNode);
        consume(realmId, amount, consumeReasonCode, v, r, s);
    }

    // Reverts if the signature format is not correct (realmId, realmIdVersion, amount, currentSeason, reasonCode, nonce)
    // Reverts if the signer is not the realmId owner
    // Reverts if the signer does not have enough balance
    // Reverts if the consumeReasonCodes do not exist or the value is false in the mapping
    // Emits a {Consumed} event
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

    // Reverts if the sender is not the owner of the realmId
    // Reverts if the sender does not have enough balance
    // Reverts if the consumeReasonCodes do not exist or the value is false in the mapping
    // Emits a {Consumed} event
    function consume(bytes32 parentNode, string memory _name, uint256 amount, bytes32 consumeReasonCode) public {
        uint256 realmId = realmIdContract.getTokenId(_name, parentNode);
        consume(realmId, amount, consumeReasonCode);
    }

    // Reverts if the sender is not the owner of the realmId
    // Reverts if the sender does not have enough balance
    // Reverts if the consumeReasonCodes do not exist or the value is false in the mapping
    // Emits a {Consumed} event
    function consume(uint256 realmId, uint256 amount, bytes32 consumeReasonCode) public {
        address owner_ = realmIdContract.ownerOf(realmId);
        require(_msgSender() == owner_, "Sender is not the owner");

        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        _consume(realmId, realmIdVersion, amount, consumeReasonCode, _msgSender());
    }

    // Get the balance of a given realmId for a specific season.
    function balanceOf(bytes32 season, uint256 realmId) external view returns (uint256) {
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        return balances[season][realmId][realmIdVersion];
    }

    // Get the balance of a given realmId for a specific season.
    function balanceOf(bytes32 season, bytes32 parentNode, string memory _name) external view returns (uint256) {
        uint256 realmId = realmIdContract.getTokenId(_name, parentNode);
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        return balances[season][realmId][realmIdVersion];
    }

    // Get the balance of a given realmId for the current season.
    function balanceOf(uint256 realmId) external view returns (uint256) {
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        return balances[currentSeason][realmId][realmIdVersion];
    }

    // Get the balance of a given realmId for the current season.
    function balanceOf(bytes32 parentNode, string memory _name) external view returns (uint256) {
        uint256 realmId = realmIdContract.getTokenId(_name, parentNode);
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        return balances[currentSeason][realmId][realmIdVersion];
    }

    //Return the payload which is generated using the arguments, current season and the realmId version
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

    //Return the payload which is generated using the arguments, current nonce, current season and the realmId version
    function preparePayload(uint256 realmId, uint256 amount, bytes32 reasonCode) public view returns (bytes32) {
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        bytes32 payload = _preparePayload(realmId, realmIdVersion, amount, nonces[realmId], reasonCode);
        return payload;
    }
}
