/* eslint-disable max-len */
/* eslint-disable mocha/no-identical-title */
const {expect} = require('chai');
const {ethers, upgrades} = require('hardhat');
const {loadFixture} = require('@animoca/ethereum-contract-helpers/src/test/fixtures');

let owner, admin, depositor, consumer, other;
let mocaPoints, mocaPointsV2, MocaPointsUpgrade;
let mockRealmContract, commonVariables;
let MocaPoints;

const setupMocaPointsAndRolesAndCommonVariables = async function () {
  let owner, admin, depositor;

  // Common variables used in contract initialization, deposit, consume and other tests below
  const reasonCode = ethers.encodeBytes32String('reason');
  const season = ethers.encodeBytes32String('season');
  const parentNode = ethers.encodeBytes32String('parentNode');
  const name = 'xyz';
  const amount = 100;
  [owner, admin, depositor] = await ethers.getSigners();
  const ADMIN_ROLE = '0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775';
  const DEPOSITOR_ROLE = '0x8f4f2da22e8ac8f11e15f9fc141cddbb5deea8800186560abb6e68c5496619a9';
  // Deploy the MockRealmId contract
  const realmIdContract = await ethers.getContractFactory('MockRealmId');
  const mockRealmContract = await realmIdContract.deploy();
  const realmId = await mockRealmContract.getTokenId(name, parentNode);
  const realmIdVersion = Number(await mockRealmContract.burnCounts(realmId));
  // Deploy the MocaPoints contract
  const MocaPoints = await ethers.getContractFactory('MocaPoints');
  const mocaPoints = await upgrades.deployProxy(MocaPoints, [mockRealmContract.target, owner.address], {
    initializer: 'initialize',
    kind: 'uups',
  });

  // Grant roles to accounts
  await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin.address);
  await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor.address);

  return {mocaPoints, mockRealmContract, MocaPoints, reasonCode, season, parentNode, name, amount, realmId, realmIdVersion};
};

describe('Contract Initialization Test', function () {
  beforeEach(async function () {
    [owner, admin, depositor] = await ethers.getSigners();
    const {mocaPoints: mp, mockRealmContract: mrc, MocaPoints: MP} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);
    mockRealmContract = mrc;
    MocaPoints = MP;
  });

  it('should revert when setting the realmIdContract address to zero address', async function () {
    const realmIdContractAddress = ethers.ZeroAddress;
    await expect(
      upgrades.deployProxy(MocaPoints, [realmIdContractAddress, owner.address], {initializer: 'initialize', kind: 'uups'})
    ).to.be.revertedWith('Not a valid Contract Address');
  });

  it('should revert when setting the owner address to zero address', async function () {
    const ownerAddress = ethers.ZeroAddress;
    await expect(
      upgrades.deployProxy(MocaPoints, [mockRealmContract.target, ownerAddress], {initializer: 'initialize', kind: 'uups'})
    ).to.be.revertedWith('Not a valid Admin Address');
  });

  it('should correctly intialize the contract with a realmIdContract address and valid owner address', async function () {
    await upgrades.deployProxy(MocaPoints, [mockRealmContract.target, owner.address], {initializer: 'initialize', kind: 'uups'});
  });
});

describe('Season Related Test', function () {
  beforeEach(async function () {
    [other] = await ethers.getSigners();
    const {mocaPoints: mp, mockRealmContract: mrc} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);
    mocaPoints = mp;
    mockRealmContract = mrc;
  });

  it('should set current season', async function () {
    const newSeason = ethers.encodeBytes32String('Season1');
    await mocaPoints.connect(admin).setCurrentSeason(newSeason);
    expect(await mocaPoints.connect(admin).currentSeason()).to.equal(newSeason);
  });

  it('Should emit SetCurrentSeason event', async function () {
    const newSeason = ethers.encodeBytes32String('SEASON_ID_1');

    const tx = await mocaPoints.connect(admin).setCurrentSeason(newSeason);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('SetCurrentSeason');
    expect(args).to.deep.equal([newSeason]);
  });

  it('should prevent setting an existing season', async function () {
    const newSeason = ethers.encodeBytes32String('Season1');
    await mocaPoints.connect(admin).setCurrentSeason(newSeason);

    await expect(mocaPoints.connect(admin).setCurrentSeason(newSeason)).to.be.revertedWith('Season already set');
  });

  it('should not allow a non admin to set current season', async function () {
    const newSeason = ethers.encodeBytes32String('Season1');
    await expect(mocaPoints.connect(other).setCurrentSeason(newSeason)).to.be.reverted;
  });
});

describe('Batch Add and Remove Reason Codes Test', function () {
  beforeEach(async function () {
    [owner, admin, other] = await ethers.getSigners();

    const {mocaPoints: mp} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);
    mocaPoints = mp;
  });

  it('should add ReasonCodes', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);

    expect(await mocaPoints.allowedConsumeReasonCodes(reasonCode1)).to.equal(true);
    expect(await mocaPoints.allowedConsumeReasonCodes(reasonCode2)).to.equal(true);
  });

  it('Should emit BatchAddConsumeReasonCode event', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');

    const tx = await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);
    const receipt = await tx.wait();

    // Check if the reason codes were added successfully
    expect(await mocaPoints.connect(admin).allowedConsumeReasonCodes(reasonCode1)).to.equal(true);
    expect(await mocaPoints.connect(admin).allowedConsumeReasonCodes(reasonCode2)).to.equal(true);

    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('BatchAddedConsumeReasonCode');
    const actualReasonCodes = args.reasonCodes.flat();
    expect(actualReasonCodes).to.deep.equal([reasonCode1, reasonCode2]);
  });

  it('should not allow a non admin to add ReasonCodes', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await expect(mocaPoints.connect(other).batchAddConsumeReasonCodes([reasonCode1, reasonCode2])).to.be.reverted;
  });

  it('should revert on adding exixting ReasonCodes', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);
    await expect(mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1])).to.be.revertedWith('Reason code already exists');
  });

  it('should revert when adding an empty array of reason codes', async function () {
    // Attempt to add an empty array of reason codes
    await expect(mocaPoints.connect(admin).batchAddConsumeReasonCodes([])).to.be.revertedWith('Empty Reason codes array');
  });

  it('should remove reason codes correctly', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);

    await mocaPoints.connect(admin).batchRemoveConsumeReasonCodes([reasonCode1, reasonCode2]);

    expect(await mocaPoints.connect(admin).allowedConsumeReasonCodes(reasonCode1)).to.equal(false);
  });

  it('Should emit BatchRemovedConsumeReasonCode event', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);

    const tx = await mocaPoints.connect(admin).batchRemoveConsumeReasonCodes([reasonCode1, reasonCode2]);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('BatchRemovedConsumeReasonCode');
    const actualReasonCodes = args.reasonCodes;
    expect(actualReasonCodes).to.deep.equal([reasonCode1, reasonCode2]);
  });

  it('should not allow non admin to remove reason codes correctly', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);

    await expect(mocaPoints.connect(other).batchRemoveConsumeReasonCodes([reasonCode1, reasonCode2])).to.be.reverted;
  });

  it('should revert on removing reason codes that does not exist', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    const reasonCode3 = ethers.encodeBytes32String('Reason3');
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);

    await expect(mocaPoints.connect(admin).batchRemoveConsumeReasonCodes([reasonCode1, reasonCode3])).to.be.revertedWith(
      'Reason code does not exist'
    );
  });

  it('should revert when removing an empty array of reason codes', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);

    // Attempt to remove an empty array of reason codes
    await expect(mocaPoints.connect(admin).batchRemoveConsumeReasonCodes([])).to.be.revertedWith('Empty Reason codes array ');
  });
});

describe('Deposit Test', function () {
  beforeEach(async function () {
    [owner, admin, depositor, consumer, other] = await ethers.getSigners();
    const {mocaPoints: mp, mockRealmContract: mrc} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);
    mocaPoints = mp;
    mockRealmContract = mrc;
  });

  it('should deposit tokens and update balances correctly with deposit function for parentNode and name', async function () {
    const {reasonCode, season, parentNode, name, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);
    const balance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId));

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](season, parentNode, name, realmIdVersion, amount, reasonCode);

    // After depositing, get the updated balance for the same account
    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId));
    const finalbalance = balance + 100;

    // Check that the balance is increased by the deposited amount
    expect(updatedBalance).to.equal(finalbalance);
  });

  it('Should emit Deposited event with parentNode and name', async function () {
    const {reasonCode, season, parentNode, name, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    const tx = await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](season, parentNode, name, realmIdVersion, amount, reasonCode);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('Deposited');
    expect(args).to.deep.equal([depositor.address, season, reasonCode, realmId, realmIdVersion, amount]);
  });

  it('should not allow someone without a depositor role to deposit tokens with deposit function for parentNode and name', async function () {
    const {reasonCode, season, parentNode, name, amount, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    await expect(
      mocaPoints
        .connect(other)
        ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](season, parentNode, name, realmIdVersion, amount, reasonCode)
    ).to.be.reverted;
  });

  it('should deposit tokens and update balances correctly with deposit for season and realmId', async function () {
    const {reasonCode, season, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    const balance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId));

    await mocaPoints.connect(depositor)['deposit(bytes32,uint256,uint256,uint256,bytes32)'](season, realmId, realmIdVersion, amount, reasonCode);
    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId));
    const finalbalance = balance + 100;

    expect(updatedBalance).to.equal(finalbalance);
  });

  it('Should emit Deposited event with realmId', async function () {
    const {reasonCode, season, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    const tx = await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](season, realmId, realmIdVersion, amount, reasonCode);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('Deposited');
    expect(args).to.deep.equal([depositor.address, season, reasonCode, realmId, realmIdVersion, amount]);
  });

  it('should not allow someone without a depositor role to deposit tokens with deposit for season and realmId', async function () {
    const {reasonCode, season, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    await expect(mocaPoints.connect(other)['deposit(bytes32,uint256,uint256,uint256,bytes32)'](season, realmId, realmIdVersion, amount, reasonCode))
      .to.be.reverted;
  });
});

describe('Consume Test', function () {
  beforeEach(async function () {
    [owner, admin, depositor, consumer, other] = await ethers.getSigners();

    const {mocaPoints: mp} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);
    mocaPoints = mp;
  });

  it('should consume tokens with parent node and verify the signature', async function () {
    const {reasonCode, parentNode, name, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode]);
    const nonce = await mocaPoints.nonces(realmId);
    const currentSeason = await mocaPoints.currentSeason();

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode);

    const initialBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));

    // Create a unique message to sign
    const message = ethers.solidityPackedKeccak256(
      ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
      [realmId, realmIdVersion, amount, currentSeason, reasonCode, nonce]
    );

    // Sign the message with the consumer's private key
    const signature = await consumer.signMessage(ethers.getBytes(message));

    const {v, r, s} = ethers.Signature.from(signature);

    await mocaPoints
      .connect(consumer)
      ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, name, amount, reasonCode, v, r, s);

    // Get the updated balance of the realmId after consumption
    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));
    const finalbalance = initialBalance - amount;

    // Check that the balance decreased by the consumed amount
    expect(updatedBalance).to.equal(finalbalance);
  });

  it('should emit Consumed event when consuming tokens with parent node and verify the signature', async function () {
    const {reasonCode, parentNode, name, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode]);
    const nonce = await mocaPoints.nonces(realmId);
    const currentSeason = await mocaPoints.currentSeason();

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode);

    // Create a unique message to sign
    const message = ethers.solidityPackedKeccak256(
      ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
      [realmId, realmIdVersion, amount, currentSeason, reasonCode, nonce]
    );

    const signature = await consumer.signMessage(ethers.getBytes(message));
    const {v, r, s} = ethers.Signature.from(signature);

    const tx = await mocaPoints
      .connect(consumer)
      ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, name, amount, reasonCode, v, r, s);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('Consumed');
    expect(args).to.deep.equal([realmId, currentSeason, reasonCode, consumer.address, realmIdVersion, amount, consumer.address]);
  });

  it('should consume tokens with realmId and verify the signature', async function () {
    const {reasonCode, parentNode, name, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode]);
    const currentSeason = await mocaPoints.currentSeason();
    const nonce = await mocaPoints.nonces(realmId);

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode);

    const initialBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));

    // Create a unique message to sign
    const message = ethers.solidityPackedKeccak256(
      ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
      [realmId, realmIdVersion, amount, currentSeason, reasonCode, nonce]
    );

    const signature = await consumer.signMessage(ethers.getBytes(message));
    const {v, r, s} = ethers.Signature.from(signature);

    await mocaPoints.connect(consumer)['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](realmId, amount, reasonCode, v, r, s);

    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));
    const finalbalance = initialBalance - amount;

    // Check that the balance decreased by the consumed amount
    expect(updatedBalance).to.equal(finalbalance);
  });

  it('should emit Consumed event when consuming tokens with realmId, amount and reasonCode and verify signature', async function () {
    const {reasonCode, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    const currentSeason = await mocaPoints.currentSeason();
    const nonce = await mocaPoints.nonces(realmId);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode]);

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](currentSeason, realmId, realmIdVersion, amount, reasonCode);

    // Create a unique message to sign
    const message = ethers.solidityPackedKeccak256(
      ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
      [realmId, realmIdVersion, amount, currentSeason, reasonCode, nonce]
    );
    const signature = await consumer.signMessage(ethers.getBytes(message));
    // const signature = new ethers.SigningKey('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6').sign(
    //   ethers.getBytes(ethers.solidityPackedKeccak256(['string', 'bytes32'], ['custom-prefix-MocaPoints', message]))
    // );
    const {v, r, s} = ethers.Signature.from(signature);

    const tx = await mocaPoints.connect(consumer)['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](realmId, amount, reasonCode, v, r, s);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('Consumed');
    expect(args).to.deep.equal([realmId, currentSeason, reasonCode, consumer.address, realmIdVersion, amount, consumer.address]);
  });

  it('should consume tokens with parent node', async function () {
    const {reasonCode, parentNode, name, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    const currentSeason = mocaPoints.currentSeason();
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode]);

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode);

    const initialBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));
    await mocaPoints.connect(consumer)['consume(bytes32,string,uint256,bytes32)'](parentNode, name, amount, reasonCode);

    // Get the updated balance of the realmId after consumption
    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));
    const finalbalance = initialBalance - amount;

    // Check that the balance decreased by the consumed amount
    expect(updatedBalance).to.equal(finalbalance);
  });

  it('should emit Consumed event when consuming tokens with parentNode, name, amount and reasonCode', async function () {
    const {reasonCode, parentNode, name, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    const currentSeason = await mocaPoints.currentSeason();
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode]);
    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode);

    const tx = await mocaPoints.connect(consumer)['consume(bytes32,string,uint256,bytes32)'](parentNode, name, amount, reasonCode);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('Consumed');
    expect(args).to.deep.equal([realmId, currentSeason, reasonCode, consumer.address, realmIdVersion, amount, consumer.address]);
  });

  it('should consume tokens with realmId', async function () {
    const {reasonCode, parentNode, name, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    const currentSeason = mocaPoints.currentSeason();
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode]);

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode);
    // Get the initial balance of the realmId
    const initialBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));

    await mocaPoints.connect(consumer)['consume(uint256,uint256,bytes32)'](realmId, amount, reasonCode);

    // Get the updated balance of the realmId after consumption
    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));
    const finalbalance = initialBalance - amount;

    // Check that the balance decreased by the consumed amount
    expect(updatedBalance).to.equal(finalbalance);
  });

  it('should emit Consumed event when consuming tokens with realmId, amount and reasonCode', async function () {
    const {reasonCode, parentNode, name, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    const currentSeason = await mocaPoints.currentSeason();
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode]);
    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode);

    const tx = await mocaPoints.connect(consumer)['consume(uint256,uint256,bytes32)'](realmId, amount, reasonCode);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('Consumed');
    expect(args).to.deep.equal([realmId, currentSeason, reasonCode, consumer.address, realmIdVersion, amount, consumer.address]);
  });

  it('should not allow a non-owner of realmId to consume tokens with realmId and verify the signature', async function () {
    const {reasonCode, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    const currentSeason = await mocaPoints.currentSeason();
    const nonce = await mocaPoints.nonces(realmId);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode]);

    // Create a unique message to sign
    const message = ethers.solidityPackedKeccak256(
      ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
      [realmId, realmIdVersion, amount, currentSeason, reasonCode, nonce]
    );

    const signature = await other.signMessage(ethers.getBytes(message));
    const {v, r, s} = ethers.Signature.from(signature);

    await expect(
      mocaPoints.connect(other)['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](realmId, amount, reasonCode, v, r, s)
    ).to.be.revertedWith('Signer is not the owner');
  });

  it('should allow a non-realmId owner to consume tokens with realmId', async function () {
    const {reasonCode, parentNode, name, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    const currentSeason = mocaPoints.currentSeason();
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode]);

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode);

    await expect(mocaPoints.connect(other)['consume(uint256,uint256,bytes32)'](realmId, amount, reasonCode)).to.be.revertedWith(
      'Sender is not the owner'
    );
  });

  it('should not allow to consume tokens with insufficient balance', async function () {
    const {reasonCode, amount, realmId} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode]);
    await expect(mocaPoints.connect(consumer)['consume(uint256,uint256,bytes32)'](realmId, amount, reasonCode)).to.be.revertedWith(
      'Insufficient balance'
    );
  });

  it('should not allow to consume tokens with invalid consume reason code', async function () {
    const {reasonCode, parentNode, name, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode]);
    const currentSeason = mocaPoints.currentSeason();
    const invalidconsumereasonCode = ethers.encodeBytes32String('Reason2');

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode);

    await expect(mocaPoints.connect(consumer)['consume(uint256,uint256,bytes32)'](realmId, amount, invalidconsumereasonCode)).to.be.revertedWith(
      'Invalid consume reason code'
    );
  });
});

describe('Balance Test', function () {
  beforeEach(async function () {
    [owner, admin, depositor, consumer, other] = await ethers.getSigners();
    const {mocaPoints: mp} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);
    mocaPoints = mp;
  });

  it('should return the balance of a realmId for a specific season and realmId', async function () {
    const {reasonCode, season, parentNode, name, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);
    const balance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId));

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](season, parentNode, name, realmIdVersion, amount, reasonCode);

    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId));
    const expectedBalance = balance + amount;

    expect(updatedBalance).to.equal(expectedBalance);
  });

  it('should return the balance of a realmId for a specific season, parentnode and name', async function () {
    const {reasonCode, season, parentNode, name, amount, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);
    const balance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,bytes32,string)'](season, parentNode, name));

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](season, parentNode, name, realmIdVersion, amount, reasonCode);

    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,bytes32,string)'](season, parentNode, name));
    const expectedBalance = balance + amount;

    expect(updatedBalance).to.equal(expectedBalance);
  });

  it('should return the balance of a realmId for the current season', async function () {
    const {reasonCode, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);
    const currentSeason = mocaPoints.currentSeason();
    const balance = Number(await mocaPoints.connect(depositor)['balanceOf(uint256)'](realmId));

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](currentSeason, realmId, realmIdVersion, amount, reasonCode);
    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(uint256)'](realmId));
    const expectedBalance = balance + 100;

    expect(updatedBalance).to.equal(expectedBalance);
  });

  it('should return the balance of a realmId for the current season with a given parent node and name', async function () {
    const {reasonCode, parentNode, name, amount, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);
    const currentSeason = mocaPoints.currentSeason();
    const balance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,string)'](parentNode, name));

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode);

    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,string)'](parentNode, name));
    const expectedBalance = balance + amount;

    expect(updatedBalance).to.equal(expectedBalance);
  });
});

describe('Additional Test', function () {
  beforeEach(async function () {
    [owner, admin, depositor] = await ethers.getSigners();

    const {mocaPoints: mp, mockRealmContract: mrc} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);
    mocaPoints = mp;
    mockRealmContract = mrc;
  });

  it('should prepare the payload correctly', async function () {
    const {reasonCode, amount, realmId, realmIdVersion} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);

    const nonce = await mocaPoints.nonces(realmId);
    const currentSeason = await mocaPoints.currentSeason();

    const payload = await mocaPoints.preparePayload(realmId, amount, reasonCode);

    const expectedPayload = ethers.solidityPackedKeccak256(
      ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
      [realmId, realmIdVersion, amount, currentSeason, reasonCode, nonce]
    );
    // Check that the prepared payload matches the expected payload
    expect(payload).to.equal(expectedPayload);
  });

  it('should not allow re-initialization of contract', async function () {
    const mockRealmIdContract = mockRealmContract.target;
    const owner_ = owner.address;
    // Attempt to initialize the contract again, it should revert
    await expect(mocaPoints.initialize(mockRealmIdContract, owner_)).to.be.revertedWith('Initializable: contract is already initialized');
  });
});

describe('Upgradeability-Test', function () {
  beforeEach(async function () {
    [owner, admin, depositor, other] = await ethers.getSigners();

    const {mocaPoints: mp} = await loadFixture(setupMocaPointsAndRolesAndCommonVariables);
    mocaPoints = mp;
    MocaPointsUpgrade = await ethers.getContractFactory('MocaPointsUpgrade');
    mocaPointsV2 = await upgrades.upgradeProxy(mocaPoints.target, MocaPointsUpgrade.connect(owner));
  });

  it('should allow the owner to authorize an upgrade', async function () {
    await upgrades.upgradeProxy(mocaPoints.target, MocaPointsUpgrade.connect(owner));
  });

  it('should not allow a non owner to authorize an upgrade', async function () {
    await expect(upgrades.upgradeProxy(mocaPoints.target, MocaPointsUpgrade.connect(other))).to.be.reverted;
  });

  it('upgradeability test: should call setVal function of MocaPointsUpgrade', async function () {
    const val = 42;
    await mocaPointsV2.setVal(val);
    expect(await mocaPointsV2.val()).to.be.equal(val);
  });

  it('upgradeability test: should emit ValueSet event from MocaPointsUpgrade', async function () {
    const val = 42;

    const tx = await mocaPointsV2.setVal(val);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('ValueSet');
    expect(args).to.deep.equal([val]);
  });
});
