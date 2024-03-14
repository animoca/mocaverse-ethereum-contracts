// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract MockRealmId {
    function burnCounts(uint256) public pure returns (uint256) {
        return 0;
    }

    function getTokenId(string calldata name, bytes32 parentNode) public pure returns (uint256) {
        bytes32 nodehash = keccak256(abi.encodePacked(parentNode, keccak256(bytes(name))));
        return uint256(nodehash);
    }

    function ownerOf(uint256 tokenId) public pure returns (address) {
        if (tokenId == uint256(96020617791342826274304566435652520856460914816153551098821572269389244416493)) {
            return address(0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65); //EOA
        } else {
            return address(0x5FbDB2315678afecb367f032d93F642f64180aa3); //1271
        }
    }
}
