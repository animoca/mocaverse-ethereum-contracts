// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

// import {RealmId} from "../realmIdContract/RealmId.sol";

interface IRealmId {
    function allowedParentNodes(bytes32 parentNode) external view returns (bool);

    function burnCounts(uint256 realmId) external view returns (uint256);

    function getTokenId(string calldata name, bytes32 parentNode) external pure returns (uint256);

    function ownerOf(uint256 realmId) external view returns (address);

    function register(string calldata _name, bytes32 parentNode, address to, bytes calldata preData) external returns (uint256);

    function allowNode(
        string calldata label,
        bytes32 parentNode,
        bool allow,
        string calldata baseTokenURI,
        address middleware,
        bytes calldata middlewareData
    ) external returns (bytes32 allowedNode);

    function available(string calldata _name, bytes32 parentNode) external view returns (bool);
}
