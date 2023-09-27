// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {AccessControlStorage} from "@animoca/ethereum-contracts/contracts/access/libraries/AccessControlStorage.sol";
import {MocaPoints} from "./MocaPoints.sol";

contract MocaPointsV2 is MocaPoints {
    using AccessControlStorage for AccessControlStorage.Layout;

    function setCurrentSeason(bytes32 _season) external override {
        AccessControlStorage.layout().enforceHasRole(ADMIN_ROLE, _msgSender());
        require(!seasons[_season], "Season already set");
        currentSeason = keccak256(abi.encodePacked(_season));
        seasons[_season] = true;
        emit SetCurrentSeason(_season);
    }
}
