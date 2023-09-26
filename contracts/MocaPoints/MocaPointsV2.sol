// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// import {AccessControlBase} from "@animoca/ethereum-contracts/contracts/access/base/AccessControlBase.sol";
// import {ContractOwnershipBase} from "@animoca/ethereum-contracts/contracts/access/base/ContractOwnershipBase.sol";
// import {ContractOwnershipStorage} from "@animoca/ethereum-contracts/contracts/access/libraries/ContractOwnershipStorage.sol";
import {AccessControlStorage} from "@animoca/ethereum-contracts/contracts/access/libraries/AccessControlStorage.sol";
import {MocaPoints} from "./MocaPoints.sol";

contract MocaPointsV2 is MocaPoints {
    uint256 public a;
    uint256 public b;
    uint256 public upgradeTestValue;

    // using ContractOwnershipStorage for ContractOwnershipStorage.Layout;
    using AccessControlStorage for AccessControlStorage.Layout;

    event UpgradeTestValueSet(uint256 value);

    function setValues(uint256 _a, uint256 _b) external {
        a = _a;
        b = _b;
    }

    function getA() public view returns (uint256) {
        return a;
    }

    function getB() public view returns (uint256) {
        return b;
    }

    function multiplyNumbers() public view returns (uint256) {
        return (a * b) * (a * b);
    }

    function getBurnCounts() public pure returns (uint256) {
        return 1;
    }

    // the consume function from the parent contract
    // function consume(uint256 val) public returns (uint256) {
    //     // Set upgradeTestValue and emit the event
    //     upgradeTestValue = val;
    //     emit UpgradeTestValueSet(val);
    //     return upgradeTestValue;
    // }

    // function consume(uint256 realmId, uint256, bytes32) public override {
    //     upgradeTestValue = realmId;
    //     emit UpgradeTestValueSet(realmId);
    // }

    function setCurrentSeason(bytes32 _season) external override {
        AccessControlStorage.layout().enforceHasRole(ADMIN_ROLE, _msgSender());
        require(!seasons[_season], "Season already set");
        currentSeason = keccak256(abi.encodePacked(_season));
        seasons[_season] = true;
        // emit SetCurrentSeason(currentSeason);
    }

    // function batchAddConsumeReasonCodes(bytes32[] memory _reasonCodes) public override {
    //     // AccessControlStorage.layout().enforceHasRole(ADMIN_ROLE, _msgSender());
    //     for (uint256 i = 0; i < _reasonCodes.length; i++) {
    //         require(!allowedConsumeReasonCodes[_reasonCodes[i]], "Reason code already exists");
    //         allowedConsumeReasonCodes[_reasonCodes[i]] = true;
    //     }

    //     emit BatchAddedConsumeReasonCode(_reasonCodes);
    // }

    // function batchRemoveConsumeReasonCodes(bytes32[] memory _reasonCodes) public override {
    //     // AccessControlStorage.layout().enforceHasRole(ADMIN_ROLE, _msgSender());

    //     // Check if each reason code exists and can be removed
    //     for (uint256 i = 0; i < _reasonCodes.length; i++) {
    //         require(allowedConsumeReasonCodes[_reasonCodes[i]], "Reason code does not exist");
    //         delete allowedConsumeReasonCodes[_reasonCodes[i]];
    //     }

    //     emit BatchRemovedConsumeReasonCode(_reasonCodes);
    // }
}
