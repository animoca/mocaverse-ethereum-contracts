const {mergeConfigs} = require('@animoca/ethereum-contract-helpers/src/config');

require('dotenv').config();
require('@animoca/ethereum-contract-helpers/hardhat-plugins');
require('@openzeppelin/hardhat-upgrades');
require('@nomiclabs/hardhat-ethers');
// require('@nomiclabs/hardhat-waffle');

module.exports = mergeConfigs(
  require('@animoca/ethereum-contract-helpers/hardhat-config'),
  require('@animoca/ethereum-contracts/hardhat-config'),
  require('./hardhat-config')
);
