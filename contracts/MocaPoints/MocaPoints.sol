// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IRealmId} from "./interface/mock/IRealmId.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {AccessControlStorage} from "@animoca/ethereum-contracts/contracts/access/libraries/AccessControlStorage.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract MocaPoints is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    // Roles
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    // Seasonal variables
    bytes32 public currentSeason;
    mapping(bytes32 => bool) public seasons;

    // Address of the RealmId contract
    IRealmId public realmIdContract;

    // Balances mapping
    mapping(bytes32 => mapping(uint256 => mapping(uint256 => uint256))) public balances; // season => realmId => realmIdVersion => balance

    // Nonce mapping
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
        address realmIdOwner,
        uint256 nonce
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _realmIdContract, address _adminAddress) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        require(address(_realmIdContract) != address(0), "Not a valid Contract Address");
        require(address(_adminAddress) != address(0), "Not a valid Admin Address");

        _grantRole(DEFAULT_ADMIN_ROLE, _adminAddress);
        realmIdContract = IRealmId(_realmIdContract);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    function setCurrentSeason(bytes32 _season) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not an admin");
        require(!seasons[_season], "Season already set");
        currentSeason = _season;
        seasons[_season] = true;
        emit SetCurrentSeason(_season);
    }

    function batchAddConsumeReasonCodes(bytes32[] memory _reasonCodes) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not an admin");
        // Check if each reason code is unique and does not already exist
        for (uint256 i = 0; i < _reasonCodes.length; i++) {
            require(!allowedConsumeReasonCodes[_reasonCodes[i]], "Reason code already exists");
            allowedConsumeReasonCodes[_reasonCodes[i]] = true;
        }

        // Emit the event to indicate that all reason codes were added
        emit BatchAddedConsumeReasonCode(_reasonCodes);
    }

    function batchRemoveConsumeReasonCodes(bytes32[] memory _reasonCodes) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not an admin");

        // Check if each reason code exists and can be removed
        for (uint256 i = 0; i < _reasonCodes.length; i++) {
            require(allowedConsumeReasonCodes[_reasonCodes[i]], "Reason code does not exist");
            delete allowedConsumeReasonCodes[_reasonCodes[i]];
        }

        // Emit the event to indicate that all reason codes were removed
        emit BatchRemovedConsumeReasonCode(_reasonCodes);
    }

    function deposit(bytes32 season, uint256 realmId, uint256 realmIdVersion, uint256 amount, bytes32 depositReasonCode) public {
        // Check if the sender has the Depositor role
        require(hasRole(DEPOSITOR_ROLE, msg.sender), "Not a depositor");

        // Call the internal _deposit function to perform the deposit operation
        balances[season][realmId][realmIdVersion] += amount;

        // Emit the Deposit event
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
        // Create the realmId using parentNode and name
        uint256 realmId = realmIdContract.getTokenId(name, parentNode);

        // Call the internal _deposit function to perform the deposit operation
        deposit(season, realmId, realmIdVersion, amount, depositReasonCode);
    }

    function _getSigner(
        uint256 realmId,
        uint256 realmIdVersion,
        uint256 amount,
        uint256 nonce,
        bytes32 consumeReasonCode,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal view returns (address) {
        bytes32 _messageHash = _preparePayload(realmId, realmIdVersion, amount, consumeReasonCode, nonce);
        bytes32 messageDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash));
        return ecrecover(messageDigest, v, r, s);
    }

    function _consume(uint256 realmId, uint256 realmIdVersion, uint256 amount, bytes32 consumeReasonCode, address owner_) internal {
        // Check if the sender has enough balance
        require(balances[currentSeason][realmId][realmIdVersion] >= amount, "Insufficient balance");

        // Check if the consumeReasonCode exists and is true in the mapping
        require(allowedConsumeReasonCodes[consumeReasonCode], "Invalid consume reason code");

        // Perform the consume operation
        balances[currentSeason][realmId][realmIdVersion] -= amount;

        // Emit the Consumed event
        emit Consumed(realmId, currentSeason, consumeReasonCode, msg.sender, realmIdVersion, amount, owner_, nonces[realmId]);
        // Increment the nonce for the realmId
        nonces[realmId]++;
    }

    function consume(bytes32 parentNode, string memory _name, uint256 amount, bytes32 consumeReasonCode, uint8 v, bytes32 r, bytes32 s) public {
        // get the realmId using parentNode and name
        uint256 realmId = realmIdContract.getTokenId(_name, parentNode);

        consume(realmId, amount, consumeReasonCode, v, r, s);
    }

    function consume(uint256 realmId, uint256 amount, bytes32 consumeReasonCode, uint8 v, bytes32 r, bytes32 s) public {
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        address signer = _getSigner(realmId, realmIdVersion, amount, nonces[realmId], consumeReasonCode, v, r, s);
        address owner_ = realmIdContract.ownerOf(realmId);
        require(signer == owner_, "Signer not owner of realmId");
        _consume(realmId, realmIdVersion, amount, consumeReasonCode, owner_);
    }

    function consume(bytes32 parentNode, string memory _name, uint256 amount, bytes32 consumeReasonCode) public {
        // Compute the realmId using the provided parentNode and name
        uint256 realmId = realmIdContract.getTokenId(_name, parentNode);
        // consumWithrealId call
        consume(realmId, amount, consumeReasonCode);
    }

    function consume(uint256 realmId, uint256 amount, bytes32 consumeReasonCode) public {
        address owner_ = realmIdContract.ownerOf(realmId);
        require(msg.sender == owner_, "Sender not owner of realmId");

        // Call the common _consume function for the core consume operation
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);
        _consume(realmId, realmIdVersion, amount, consumeReasonCode, msg.sender);
    }

    function balanceOf(bytes32 season, uint256 realmId) external view returns (uint256) {
        // get realmIdVersion from the realmId contract
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);

        return balances[season][realmId][realmIdVersion];
    }

    function balanceOf(bytes32 season, bytes32 parentNode, string memory _name) external view returns (uint256) {
        // Compute the realmId using the provided parentNode and name
        uint256 realmId = realmIdContract.getTokenId(_name, parentNode);

        // get realmIdVersion from the realmId contract
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);

        // Retrieve and return the balance for the calculated realmId
        return balances[season][realmId][realmIdVersion];
    }

    function balanceOf(uint256 realmId) external view returns (uint256) {
        // get realmIdVersion from the realmId contract
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);

        // Retrieve and return the balance for the given realmId at the current season
        return balances[currentSeason][realmId][realmIdVersion];
    }

    function balanceOf(bytes32 parentNode, string memory _name) external view returns (uint256) {
        // Compute the realmId using the provided parentNode and name
        uint256 realmId = realmIdContract.getTokenId(_name, parentNode);

        // get realmIdVersion from the realmId contract
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);

        // Retrieve and return the balance for the given realmId at the current season
        return balances[currentSeason][realmId][realmIdVersion];
    }

    // Return the payload which is generated using the arguments, current season and the realmIdversion
    function _preparePayload(
        uint256 realmId,
        uint256 realmIdVersion,
        uint256 amount,
        bytes32 reasonCode,
        uint256 nonce
    ) internal view returns (bytes32) {
        bytes32 payload = keccak256(abi.encodePacked(realmId, realmIdVersion, amount, currentSeason, reasonCode, nonce));
        return payload;
    }

    // Return the payload which is generated using the arguments, current nonce, current season, and the realmId version
    function preparePayload(uint256 realmId, uint256 amount, bytes32 reasonCode) public view returns (bytes32) {
        // get realmIdVersion from the realmId contract
        uint256 realmIdVersion = realmIdContract.burnCounts(realmId);

        return (_preparePayload(realmId, realmIdVersion, amount, reasonCode, nonces[realmId]));
    }
}
