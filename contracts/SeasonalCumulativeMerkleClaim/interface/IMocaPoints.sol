// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

interface IMocaPoints {

    function seasons(bytes32) external view returns (bool);
    function deposit(bytes32 season, uint256 realmId, uint256 realmIdVersion, uint256 amount, bytes32 depositReasonCode) external;
}