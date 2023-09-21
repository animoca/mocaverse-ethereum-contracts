// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract MockRealmId {
    function burnCounts(uint256) public pure returns (uint256) {
        return 0;
    }

    function getTokenId(string calldata, bytes32) public pure returns (uint256) {
        return 10;
    }

    function ownerOf(uint256) public pure returns (address) {
        return address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC);
    }
}
