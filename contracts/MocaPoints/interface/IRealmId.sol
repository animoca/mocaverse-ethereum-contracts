// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

interface IRealmId {
    function burnCounts(uint256 realmId) external view returns (uint256);

    function getTokenId(string calldata name, bytes32 parentNode) external pure returns (uint256);

    function ownerOf(uint256 realmId) external view returns (address);
}
