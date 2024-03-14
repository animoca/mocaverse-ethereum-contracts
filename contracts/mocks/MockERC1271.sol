// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ContractOwnership} from "@animoca/ethereum-contracts/contracts/access/ContractOwnership.sol";

contract MockERC1271 is ContractOwnership, IERC1271 {
    constructor(address owner) ContractOwnership(owner) {}

    function isValidSignature(bytes32 hash, bytes calldata signature) public view override returns (bytes4) {
        if (ECDSA.recover(hash, signature) == owner()) {
            return 0x1626ba7e;
        } else {
            return 0xffffffff;
        }
    }
}
