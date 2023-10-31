// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {MocaPoints} from "../../MocaPoints.sol";

contract MockMocaPointsUpgrade is MocaPoints {

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address realmIdContract) MocaPoints(realmIdContract) {}

    function initializeV2() public reinitializer(2) {}

    uint256 public val;

    function setVal(uint256 _newVal) public {
        val = _newVal;
    }
}
