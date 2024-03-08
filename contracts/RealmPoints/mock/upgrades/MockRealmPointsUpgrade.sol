// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {RealmPoints} from "../../RealmPoints.sol";

contract MockRealmPointsUpgrade is RealmPoints {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address realmIdContract) RealmPoints(realmIdContract) {}

    function initializeV2(uint256 _newVal) public reinitializer(2) {
        val = _newVal;
    }

    uint256 public val;
}
