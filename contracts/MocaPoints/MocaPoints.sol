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

    function initialize(address _realmIdContract, address _owner) public initializer {
        __UUPSUpgradeable_init();
        require(_realmIdContract != address(0), "Not a valid Contract Address");
        require(_owner != address(0), "Not a valid Admin Address");
        ContractOwnershipStorage.layout().proxyInit(_owner);
        realmIdContract = IRealmId(_realmIdContract);
    }

    function _authorizeUpgrade(address) internal view override {
        AccessControlStorage.layout().enforceHasRole(ADMIN_ROLE, _msgSender());
    }

    function setCurrentSeason(bytes32 _season) external virtual {
        AccessControlStorage.layout().enforceHasRole(ADMIN_ROLE, _msgSender());
        require(!seasons[_season], "Season already set");
        currentSeason = _season;
        seasons[_season] = true;
        emit SetCurrentSeason(_season);
    }

    function batchAddConsumeReasonCodes(bytes32[] memory _reasonCodes) public virtual {
        AccessControlStorage.layout().enforceHasRole(ADMIN_ROLE, _msgSender());
        for (uint256 i = 0; i < _reasonCodes.length; i++) {
            require(!allowedConsumeReasonCodes[_reasonCodes[i]], "Reason code already exists");
            allowedConsumeReasonCodes[_reasonCodes[i]] = true;
        }

        emit BatchAddedConsumeReasonCode(_reasonCodes);
    }

    function batchRemoveConsumeReasonCodes(bytes32[] memory _reasonCodes) public virtual {
        AccessControlStorage.layout().enforceHasRole(ADMIN_ROLE, _msgSender());

        // Check if each reason code exists and can be removed
        for (uint256 i = 0; i < _reasonCodes.length; i++) {
            require(allowedConsumeReasonCodes[_reasonCodes[i]], "Reason code does not exist");
            delete allowedConsumeReasonCodes[_reasonCodes[i]];
        }

        emit BatchRemovedConsumeReasonCode(_reasonCodes);
    }

    function deposit(bytes32 season, uint256 realmId, uint256 realmIdVersion, uint256 amount, bytes32 depositReasonCode) public virtual {
        // Check if the sender has the Depositor role
        AccessControlStorage.layout().enforceHasRole(DEPOSITOR_ROLE, _msgSender());

        // increase balance
        balances[season][realmId][realmIdVersion] += amount;

        emit Deposited(msg.sender, season, depositReasonCode, realmId, realmIdVersion, amount);
    }

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

        emit Consumed(realmId, currentSeason, consumeReasonCode, msg.sender, realmIdVersion, amount, owner_);
        nonces[realmId]++;
    }

    function consume(
        bytes32 parentNode,
        string memory _name,
        uint256 amount,
        bytes32 consumeReasonCode,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual {
        uint256 realmId = realmIdContract.getTokenId(_name, parentNode);
        consume(realmId, amount, consumeReasonCode, v, r, s);
    }

    function consume(uint256 realmId, uint256 amount, bytes32 consumeReasonCode, uint8 v, bytes32 r, bytes32 s) public virtual {
        // get realmIdVersion from the realmId contract
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        bytes32 _messageHash = _preparePayload(realmId, realmIdVersion, amount, nonces[realmId], consumeReasonCode);
        bytes32 messageDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash));
        address signer = ecrecover(messageDigest, v, r, s);
        address owner_ = realmIdContract.ownerOf(realmId);
        require(signer == owner_, "Signer is not the owner");
        _consume(realmId, realmIdVersion, amount, consumeReasonCode, owner_);
    }

    function consume(bytes32 parentNode, string memory _name, uint256 amount, bytes32 consumeReasonCode) public virtual {
        uint256 realmId = realmIdContract.getTokenId(_name, parentNode);
        consume(realmId, amount, consumeReasonCode);
    }

    function consume(uint256 realmId, uint256 amount, bytes32 consumeReasonCode) public virtual {
        address owner_ = realmIdContract.ownerOf(realmId);
        require(msg.sender == owner_, "Sender is not the owner");

        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        _consume(realmId, realmIdVersion, amount, consumeReasonCode, msg.sender);
    }

    function balanceOf(bytes32 season, uint256 realmId) external view returns (uint256) {
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        return balances[season][realmId][realmIdVersion];
    }

    function balanceOf(bytes32 season, bytes32 parentNode, string memory _name) external view returns (uint256) {
        uint256 realmId = realmIdContract.getTokenId(_name, parentNode);
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        return balances[season][realmId][realmIdVersion];
    }

    function balanceOf(uint256 realmId) external view returns (uint256) {
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        return balances[currentSeason][realmId][realmIdVersion];
    }

    function balanceOf(bytes32 parentNode, string memory _name) external view returns (uint256) {
        uint256 realmId = realmIdContract.getTokenId(_name, parentNode);
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        return balances[currentSeason][realmId][realmIdVersion];
    }

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

    function preparePayload(uint256 realmId, uint256 amount, bytes32 reasonCode) public view returns (bytes32) {
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        bytes32 payload = _preparePayload(realmId, realmIdVersion, amount, nonces[realmId], reasonCode);
        return payload;
    }
}
