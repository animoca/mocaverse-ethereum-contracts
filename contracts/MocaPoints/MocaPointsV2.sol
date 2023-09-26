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

    function setCurrentSeason(bytes32 _season) external override {
        AccessControlStorage.layout().enforceHasRole(ADMIN_ROLE, _msgSender());
        require(!seasons[_season], "Season already set");
        currentSeason = keccak256(abi.encodePacked(_season));
        seasons[_season] = true;
    }
}
