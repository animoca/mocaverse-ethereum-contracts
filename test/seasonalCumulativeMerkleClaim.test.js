const {expect} = require('chai');
const {ethers, upgrades} = require('hardhat');
const {loadFixture} = require('@animoca/ethereum-contract-helpers/src/test/fixtures');

describe('SeasonalCumulativeMerkleClaim', function () {
  let owner, admin, depositor, consumer, other;

  const amount = 100;
  const consumeReasonCode = ethers.encodeBytes32String('consumeReason');
  const parentNode = ethers.encodeBytes32String('parentNode');
  const name = 'xyz';

  before(async function () {
    [owner, admin, depositor, consumer, other] = await ethers.getSigners();
  });

  const fixture = async function () {
    [owner, admin, depositor] = await ethers.getSigners();

    // Deploy the MockRealmId contract
    const MockRealmIdContract = await ethers.getContractFactory('MockRealmId');
    this.mockRealmId = await MockRealmIdContract.deploy();
    this.mockRealmIdAddress = this.mockRealmId.target;

    this.realmId = Number(await this.mockRealmId.getTokenId(name, parentNode));
    this.realmIdVersion = Number(await this.mockRealmId.burnCounts(this.realmId));

    // Deploy the MocaPoints contract
    this.MocaPointsContract = await ethers.getContractFactory('MocaPoints');
    this.mocaPoints = await upgrades.deployProxy(this.MocaPointsContract, [], {
      initializer: 'initialize',
      kind: 'uups',
      constructorArgs: [this.mockRealmIdAddress],
    });

    this.ADMIN_ROLE = ethers.keccak256(Buffer.from('ADMIN_ROLE'));
    this.DEPOSITOR_ROLE = ethers.keccak256(Buffer.from('DEPOSITOR_ROLE'));
    await this.mocaPoints.connect(owner).grantRole(this.ADMIN_ROLE, admin.address);
    await this.mocaPoints.connect(owner).grantRole(this.DEPOSITOR_ROLE, depositor.address);
  };

  beforeEach(async function () {
    await loadFixture(fixture, this);
  });
});
