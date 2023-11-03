// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {MocaPoints} from "../../MocaPoints.sol";

contract MockMocaPointsUpgrade is MocaPoints {

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address realmIdContract) MocaPoints(realmIdContract) {}

    function initializeV2(uint256 _newVal) public reinitializer(2) { val = _newVal; }

    uint256 public val;
}
