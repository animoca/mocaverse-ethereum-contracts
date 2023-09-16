// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IRealmId} from "./interface/IRealmId.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract MocaPoints is Initializable, PausableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    // Seasonal variables
    bytes32 public currentSeason;
    mapping(bytes32 => bool) public seasons;

    // Address of the RealmId contract
    IRealmId public realmIdContract;

    // Admin Address
    address public adminAddress;

    // Balances mapping
    mapping(bytes32 => mapping(uint256 => mapping(uint256 => uint256))) private balances; // season => realmId => realmIdVersion => balance

    // Nonce mapping
    mapping(uint256 => uint256) public nonces; // realmId => nonce

    // Allowed consume reason codes mapping
    mapping(bytes32 => bool) private allowedConsumeReasonCodes;

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
        uint256 nonce,
        uint256 realmIdVersion,
        uint256 amount,
        address realmIdOwner
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _realmIdContract, address _adminAddress) public initializer {
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        require(address(_realmIdContract) != address(0), "Not a valid Contract Address");
        require(address(_adminAddress) != address(0), "Not a valid Admin Address");

        _grantRole(DEFAULT_ADMIN_ROLE, _adminAddress);
        _grantRole(PAUSER_ROLE, _adminAddress);
        _grantRole(UPGRADER_ROLE, _adminAddress);
        _grantRole(ADMIN_ROLE, _adminAddress);
        _grantRole(DEPOSITOR_ROLE, _adminAddress);
        realmIdContract = IRealmId(_realmIdContract);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not an admin");
        _;
    }

    modifier onlyDepositor() {
        require(hasRole(DEPOSITOR_ROLE, msg.sender), "Not a depositor");
        _;
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function setCurrentSeason(bytes32 _season) external onlyAdmin {
        require(!seasons[_season], "Season already set");
        currentSeason = _season;
        seasons[_season] = true;
        emit SetCurrentSeason(_season);
    }

    // Function to get the realmIdVersion from the RealmId contract
    function _getRealmIdVersion(uint256 realmId) internal view returns (uint256) {
        return realmIdContract.burnCounts(realmId);
    }

    function isReasonCodeAllowed(bytes32 reasonCode) external view returns (bool) {
        return allowedConsumeReasonCodes[reasonCode];
    }

    function prepareRealmId(bytes32 parentNode, string memory _name) public view returns (uint256) {
        return realmIdContract.getTokenId(_name, parentNode);
    }

    // Function to get the owner of a realmId from the RealmId contract
    function owner(uint256 realmId) internal view returns (address) {
        address _owner = realmIdContract.ownerOf(realmId);
        return _owner;
    }

    function batchAddConsumeReasonCodes(bytes32[] memory _reasonCodes) external onlyAdmin {
        // Check if each reason code is unique and does not already exist
        for (uint256 i = 0; i < _reasonCodes.length; i++) {
            require(!allowedConsumeReasonCodes[_reasonCodes[i]], "Reason code already exists");
            allowedConsumeReasonCodes[_reasonCodes[i]] = true;
        }

        // Emit the event to indicate that all reason codes were added
        emit BatchAddedConsumeReasonCode(_reasonCodes);
    }

    function batchRemoveConsumeReasonCodes(bytes32[] memory _reasonCodes) external onlyAdmin {
        // Check if each reason code exists and can be removed
        for (uint256 i = 0; i < _reasonCodes.length; i++) {
            // require(
            //     allowedConsumeReasonCodes[_reasonCodes[i]],
            //     "Reason code does not exist"
            // );
            delete allowedConsumeReasonCodes[_reasonCodes[i]];
        }

        // Emit the event to indicate that all reason codes were removed
        emit BatchRemovedConsumeReasonCode(_reasonCodes);
    }

    function _deposit(bytes32 season, uint256 realmId, uint256 realmIdVersion, uint256 amount, bytes32 depositReasonCode) internal {
        // Perform the deposit operation
        balances[season][realmId][realmIdVersion] += amount;

        // Emit the Deposit event
        emit Deposited(msg.sender, season, depositReasonCode, realmId, realmIdVersion, amount);
    }

    function deposit(bytes32 season, uint256 realmId, uint256 realmIdVersion, uint256 amount, bytes32 depositReasonCode) external onlyDepositor {
        // Check if the sender has the Depositor role
        require(hasRole(DEPOSITOR_ROLE, msg.sender), "Not a depositor");

        // Call the internal _deposit function to perform the deposit operation
        _deposit(season, realmId, realmIdVersion, amount, depositReasonCode);
    }

    function depositWithParentnode(
        bytes32 season,
        bytes32 parentNode,
        string memory name,
        uint256 realmIdVersion,
        uint256 amount,
        bytes32 depositReasonCode
    ) external onlyDepositor {
        // Create the realmId using parentNode and name
        uint256 realmId = prepareRealmId(parentNode, name);

        // Call the internal _deposit function to perform the deposit operation
        _deposit(season, realmId, realmIdVersion, amount, depositReasonCode);
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
        bytes32 messageHash = _preparePayload(realmId, realmIdVersion, amount, nonce, consumeReasonCode);
        return ecrecover(messageHash, v, r, s);
    }

    function _consumeWithSignature(uint256 realmId, uint256 amount, bytes32 consumeReasonCode, uint8 v, bytes32 r, bytes32 s) internal {
        uint256 realmIdVersion = _getRealmIdVersion(realmId);
        address signer = _getSigner(realmId, realmIdVersion, amount, nonces[realmId], consumeReasonCode, v, r, s);
        address owner_ = owner(realmId);
        require(signer == owner_, "Signer not owner of realmId");
        _consume(realmId, realmIdVersion, amount, consumeReasonCode, owner_);
    }

    function _consume(uint256 realmId, uint256 realmIdVersion, uint256 amount, bytes32 consumeReasonCode, address owner_) internal {
        // Check if the sender has enough balance
        require(balances[currentSeason][realmId][realmIdVersion] >= amount, "Insufficient balance");

        // Check if the consumeReasonCode exists and is true in the mapping
        require(allowedConsumeReasonCodes[consumeReasonCode], "Invalid consume reason code");

        // Perform the consume operation
        balances[currentSeason][realmId][realmIdVersion] -= amount;

        // Emit the Consumed event
        emit Consumed(realmId, currentSeason, consumeReasonCode, msg.sender, nonces[realmId], realmIdVersion, amount, owner_);
        // Increment the nonce for the realmId
        nonces[realmId]++;
    }

    function consumeWithParentnodeVRS(
        bytes32 parentNode,
        string memory _name,
        uint256 amount,
        bytes32 consumeReasonCode,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // get the realmId using parentNode and name
        uint256 realmId = prepareRealmId(parentNode, _name);

        _consumeWithSignature(realmId, amount, consumeReasonCode, v, r, s);
    }

    function consumeWithRealmIdVRS(uint256 realmId, uint256 amount, bytes32 consumeReasonCode, uint8 v, bytes32 r, bytes32 s) external {
        _consumeWithSignature(realmId, amount, consumeReasonCode, v, r, s);
    }

    function _consumeWithoutSignature(uint256 realmId, uint256 amount, bytes32 consumeReasonCode) internal {
        address owner_ = owner(realmId);
        require(msg.sender == owner_, "Signer not owner of realmId");

        // Call the common _consume function for the core consume operation
        uint256 realmIdVersion = _getRealmIdVersion(realmId);
        _consume(realmId, realmIdVersion, amount, consumeReasonCode, msg.sender);
    }

    function consumeWithParentnode(bytes32 parentNode, string memory _name, uint256 amount, bytes32 consumeReasonCode) external {
        // Compute the realmId using the provided parentNode and name
        uint256 realmId = prepareRealmId(parentNode, _name);

        _consumeWithoutSignature(realmId, amount, consumeReasonCode);
    }

    function consumeWithRealmId(uint256 realmId, uint256 amount, bytes32 consumeReasonCode) external {
        _consumeWithoutSignature(realmId, amount, consumeReasonCode);
    }

    function balanceOf(bytes32 season, uint256 realmId) external view returns (uint256) {
        // get realmIdVersion from the realmId contract
        uint256 realmIdVersion = _getRealmIdVersion(realmId);

        return balances[season][realmId][realmIdVersion];
    }

    function balanceOf(bytes32 season, bytes32 parentNode, string memory _name) external view returns (uint256) {
        // Compute the realmId using the provided parentNode and name
        uint256 realmId = prepareRealmId(parentNode, _name);

        // get realmIdVersion from the realmId contract
        uint256 realmIdVersion = _getRealmIdVersion(realmId);

        // Retrieve and return the balance for the calculated realmId
        return balances[season][realmId][realmIdVersion];
    }

    function balanceOf(uint256 realmId) external view returns (uint256) {
        // get realmIdVersion from the realmId contract
        uint256 realmIdVersion = _getRealmIdVersion(realmId);

        // Retrieve and return the balance for the given realmId at the current season
        return balances[currentSeason][realmId][realmIdVersion];
    }

    function balanceOf(bytes32 parentNode, string memory _name) external view returns (uint256) {
        // Compute the realmId using the provided parentNode and name
        uint256 realmId = prepareRealmId(parentNode, _name);

        // get realmIdVersion from the realmId contract
        uint256 realmIdVersion = _getRealmIdVersion(realmId);

        // Retrieve and return the balance for the given realmId at the current season
        return balances[currentSeason][realmId][realmIdVersion];
    }

    // Return the payload which is generated using the arguments, current season and the realmIdversion
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

    // Return the payload which is generated using the arguments, current nonce, current season, and the realmId version
    function preparePayload(uint256 realmId, uint256 amount, bytes32 reasonCode) external view returns (bytes32) {
        // get realmIdVersion from the realmId contract
        uint256 realmIdVersion = _getRealmIdVersion(realmId);

        return (_preparePayload(realmId, realmIdVersion, amount, nonces[realmId], reasonCode));
    }
}
