// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {MocaPoints} from "../../MocaPoints.sol";

contract MocaPointsUpgrade is MocaPoints {
    uint256 public val;

    event ValueSet(uint256 newValue);

    function setVal(uint256 _newVal) public {
        val = _newVal;
        emit ValueSet(_newVal);
    }
}
