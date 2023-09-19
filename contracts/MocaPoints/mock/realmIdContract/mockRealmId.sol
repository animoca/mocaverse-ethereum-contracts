// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {RealmId} from "./RealmId.sol";

contract MockRealmId is RealmId {
    function ownerOf(uint256) public pure override returns (address) {
        return address(0x90F79bf6EB2c4f870365E785982E1f101E93b906);
    }
}
