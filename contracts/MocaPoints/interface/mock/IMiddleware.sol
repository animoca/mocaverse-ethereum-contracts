// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity >=0.8.0;

import {DataTypes} from "../../mock/realmIdContract/DataTypes.sol";

interface IMiddleware {
    /**
     * @notice Sets data for middleware.
     *
     * @param data Extra data to set.
     */
    function setMwData(bytes calldata data) external;

    /**
     * @notice Process that runs before the name creation happens.
     *
     * @param params The params for creating name.
     * @param data Extra data to process.
     */
    function preProcess(DataTypes.RegisterNameParams calldata params, bytes calldata data) external payable;

    /**
     * @notice Validates the name pattern.
     *
     * @param name The name to validate.
     */
    function namePatternValid(string calldata name) external view returns (bool);
}
