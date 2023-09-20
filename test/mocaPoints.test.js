/* eslint-disable max-len */
/* eslint-disable mocha/no-identical-title */
const {expect} = require('chai');
const {BigNumber} = require('ethers');
const {ethers, upgrades} = require('hardhat');
require('dotenv').config();
// const Contract_deploy = require('@animoca/ethereum-migrations/src/templates/Contract/deploy');

// module.exports = Contract_deploy('ORBNFT', {
//   contract: 'ORBNFT',
//   args: [
//     {name: 'filterRegistry', value: getNamedAccount('filterRegistry')},
//     {name: 'name_', value: 'Anichess ORB'},
//     {name: 'symbol_', value: 'ORB'},
//   ],
// });

describe('MocaPoints-Test', function () {
  let depositor, recipient, signer, other, DEPOSITOR_ROLE, PAUSER_ROLE, UPGRADER_ROLE;
  let mocaPoints;
  let mockRealmContract;

  beforeEach(async function () {
    [depositor, payoutWallet, recipient, signer, owner, other] = await ethers.getSigners();

    const realmIdContract = await ethers.getContractFactory('MockRealmId');
    mockRealmContract = await realmIdContract.deploy();

    const MocaPoints = await ethers.getContractFactory('MocaPoints');
    mocaPoints = await upgrades.deployProxy(MocaPoints, [mockRealmContract.target, signer.address], {initializer: 'initialize'});
    DEPOSITOR_ROLE = await mocaPoints.DEPOSITOR_ROLE();
    PAUSER_ROLE = await mocaPoints.PAUSER_ROLE();
    UPGRADER_ROLE = await mocaPoints.UPGRADER_ROLE();
  });

  it('should set and prevent setting an existing season', async function () {
    const newSeason = ethers.encodeBytes32String('Season1');
    expect(await mocaPoints.connect(signer).currentSeason()).to.not.equal(newSeason);
    await mocaPoints.connect(signer).setCurrentSeason(newSeason);
    expect(await mocaPoints.connect(signer).currentSeason()).to.equal(newSeason);

    // Attempt to set the same season again, should revert
    await expect(mocaPoints.connect(signer).setCurrentSeason(newSeason)).to.be.revertedWith('Season already set');
  });

  it('should add and prevent adding duplicate reason codes', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await mocaPoints.connect(signer).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);

    // Check if the reason codes were added successfully
    expect(await mocaPoints.connect(signer).allowedConsumeReasonCodes(reasonCode1)).to.equal(true);
    expect(await mocaPoints.connect(signer).allowedConsumeReasonCodes(reasonCode2)).to.equal(true);

    // Attempt to add a duplicate reason code, should revert
    await expect(mocaPoints.connect(signer).batchAddConsumeReasonCodes([reasonCode1])).to.be.revertedWith('Reason code already exists');
  });

  it('should remove reason codes correctly', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await mocaPoints.connect(signer).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);

    // Remove a reason code
    await mocaPoints.connect(signer).batchRemoveConsumeReasonCodes([reasonCode1, reasonCode2]);

    // Check if the reason code was removed successfully
    expect(await mocaPoints.connect(signer).allowedConsumeReasonCodes(reasonCode1)).to.equal(false);
  });

  // // // DEPOSIT TEST

  it('should deposit tokens and update balances correctly with deposit function', async function () {
    const reasonCode = ethers.encodeBytes32String('reason');
    const season = ethers.encodeBytes32String('season');
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'xyz';
    const amount = 100;

    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = await mockRealmContract.burnCounts(realmId);
    // Call the contract function and wait for the result
    const balance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId));
    await mocaPoints.connect(signer).grantRole(DEPOSITOR_ROLE, depositor);

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](season, parentNode, name, realmIdVersion, amount, reasonCode);

    // After depositing, get the updated balance for the same account
    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId));
    const finalbalance = balance + 100;

    // Check that the balance increased by the deposited amount
    expect(updatedBalance).to.equal(finalbalance);
  });

  it('should deposit tokens and update balances correctly with season and realmId function', async function () {
    const reasonCode = ethers.encodeBytes32String('reason');
    const season = ethers.encodeBytes32String('season');
    const parentNode = ethers.encodeBytes32String('moca');
    const name = 'xyz';
    const amount = 100;

    // const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmId = await mockRealmContract['getTokenId(string, bytes32)'](name, parentNode);
    const realmIdVersion = Number(await mockRealmContract.burnCounts(realmId));
    const balance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId));
    await mocaPoints.connect(signer).grantRole(DEPOSITOR_ROLE, depositor);

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](season, parentNode, name, realmIdVersion, amount, reasonCode);

    // After depositing, get the updated balance for the same account
    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId));
    const finalbalance = balance + 100;

    // Check that the balance increased by the deposited amount
    expect(updatedBalance).to.equal(finalbalance);
  });

  // BALANCE CHECK FUNCTION TESTING

  it('should return the balance of a realmId for a specific season and realmId', async function () {
    const season = ethers.encodeBytes32String('season');
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'xyz';
    const amount = 100;
    const reasonCode = ethers.encodeBytes32String('reason');
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = mockRealmContract.burnCounts(realmId);
    const balance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId));
    await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId);

    await mocaPoints.connect(signer).grantRole(DEPOSITOR_ROLE, depositor);

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](season, parentNode, name, realmIdVersion, amount, reasonCode);

    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId));

    const expectedBalance = balance + 100;

    expect(updatedBalance).to.equal(expectedBalance);
  });

  it('should return the balance of a realmId for a specific season, parentnode and name', async function () {
    const season = ethers.encodeBytes32String('season');
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'xyz';
    const amount = 100;
    const reasonCode = ethers.encodeBytes32String('reason');
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = mockRealmContract.burnCounts(realmId);
    const balance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,bytes32,string)'](season, parentNode, name));

    await mocaPoints.connect(signer).grantRole(DEPOSITOR_ROLE, depositor);

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](season, parentNode, name, realmIdVersion, amount, reasonCode);

    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,bytes32,string)'](season, parentNode, name));

    const expectedBalance = balance + 100;

    expect(updatedBalance).to.equal(expectedBalance);
  });

  it('should return the balance of a realmId for the current season', async function () {
    const currentSeason = mocaPoints.currentSeason();
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'xyz';
    const amount = 100;
    const reasonCode = ethers.encodeBytes32String('reason');
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = mockRealmContract.burnCounts(realmId);
    const balance = Number(await mocaPoints.connect(depositor)['balanceOf(uint256)'](realmId));

    await mocaPoints.connect(signer).grantRole(DEPOSITOR_ROLE, depositor);

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode);
    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(uint256)'](realmId));

    const expectedBalance = balance + 100;

    expect(updatedBalance).to.equal(expectedBalance);
  });

  it('should return the balance of a realmId for the current season with a given parent node and name', async function () {
    const currentSeason = mocaPoints.currentSeason();
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'xyz';
    const amount = 100;
    const reasonCode = ethers.encodeBytes32String('reason');
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = mockRealmContract.burnCounts(realmId);

    const balance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,string)'](parentNode, name));

    await mocaPoints.connect(signer).grantRole(DEPOSITOR_ROLE, depositor);
    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode);

    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,string)'](parentNode, name));

    const expectedBalance = balance + 100;

    expect(updatedBalance).to.equal(expectedBalance);
  });

  // // CONSUME TEST
  it('should consume tokens with parent node and verify the signature', async function () {
    const reasonCode = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(signer).batchAddConsumeReasonCodes([reasonCode]);
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'xyz';
    const currentSeason = await mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const nonce = await mocaPoints.nonces(realmId);
    const realmIdVersion = await mockRealmContract.burnCounts(realmId);
    const amount = 20;

    await mocaPoints.connect(signer).grantRole(DEPOSITOR_ROLE, depositor);

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode);

    // Get the initial balance of the realmId
    const initialBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));

    // Create a unique message to sign
    const message = ethers.solidityPackedKeccak256(
      ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
      [realmId, realmIdVersion, amount, currentSeason, reasonCode, nonce]
    );

    // Sign the message with the consumer's private key
    const signature = await signer.signMessage(ethers.getBytes(message));

    const {v, r, s} = ethers.Signature.from(signature);

    // await mocaPoints.connect(signer).consumeWithParentnodeVRS(parentNode, name, amount, reasonCode1, v, r, s);
    await mocaPoints.connect(signer)['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, name, amount, reasonCode, v, r, s);

    // Get the updated balance of the realmId after consumption
    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));
    const finalbalance = initialBalance - amount;

    // Check that the balance decreased by the consumed amount
    expect(updatedBalance).to.equal(finalbalance);
  });

  it('should consume tokens with realmId and verify the signature', async function () {
    const reasonCode = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(signer).batchAddConsumeReasonCodes([reasonCode]);
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'xyz';
    const currentSeason = await mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const nonce = await mocaPoints.nonces(realmId);
    const realmIdVersion = await mockRealmContract.burnCounts(realmId);
    const amount = 20;

    await mocaPoints.connect(signer).grantRole(DEPOSITOR_ROLE, depositor);
    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode);

    // Get the initial balance of the realmId
    const initialBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));

    // Create a unique message to sign
    const message = ethers.solidityPackedKeccak256(
      ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
      [realmId, realmIdVersion, amount, currentSeason, reasonCode, nonce]
    );

    const signature = await signer.signMessage(ethers.getBytes(message));
    const {v, r, s} = ethers.Signature.from(signature);

    await mocaPoints.connect(signer)['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](realmId, amount, reasonCode, v, r, s);

    // Get the updated balance of the realmId after consumption
    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));
    const finalbalance = initialBalance - amount;

    // Check that the balance decreased by the consumed amount
    expect(updatedBalance).to.equal(finalbalance);
  });

  it('should consume tokens with parent node', async function () {
    const parentNode = ethers.encodeBytes32String('node');
    const name = 'xyz';
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(signer).batchAddConsumeReasonCodes([reasonCode1]);
    const currentSeason = mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = mockRealmContract.burnCounts(realmId);
    const amount = 10;

    await mocaPoints.connect(signer).grantRole(DEPOSITOR_ROLE, depositor);
    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode1);

    const initialBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));
    await mocaPoints.connect(signer)['consume(bytes32,string,uint256,bytes32)'](parentNode, name, amount, reasonCode1);

    // Get the updated balance of the realmId after consumption
    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));
    const finalbalance = initialBalance - amount;

    // Check that the balance decreased by the consumed amount
    expect(updatedBalance).to.equal(finalbalance);
  });

  it('should consume tokens with realmId', async function () {
    const name = 'xyz';
    const parentNode = ethers.encodeBytes32String('node');
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(signer).batchAddConsumeReasonCodes([reasonCode1]);
    const currentSeason = mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = mockRealmContract.burnCounts(realmId);
    const amount = 10;
    await mocaPoints.connect(signer).grantRole(DEPOSITOR_ROLE, depositor);

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode1);
    // Get the initial balance of the realmId
    const initialBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));

    await mocaPoints.connect(signer)['consume(uint256,uint256,bytes32)'](realmId, amount, reasonCode1);

    // Get the updated balance of the realmId after consumption
    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));
    const finalbalance = initialBalance - amount;

    // Check that the balance decreased by the consumed amount
    expect(updatedBalance).to.equal(finalbalance);
  });

  it('Should emit SetCurrentSeason event', async function () {
    const newSeason = ethers.encodeBytes32String('SEASON_ID_1');

    expect(await mocaPoints.connect(signer).setCurrentSeason(newSeason))
      .to.emit(mocaPoints, 'SetCurrentSeason')
      .withArgs(newSeason);
  });

  // Test for BatchAddedConsumeReasonCode event
  it('Should emit BatchAddConsumeReasonCode event', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');

    // Call batchAddConsumeReasonCodes and check if it emits the event
    expect(await mocaPoints.connect(signer).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]))
      .to.emit(mocaPoints, 'BatchAddedConsumeReasonCode')
      .withArgs([reasonCode1, reasonCode2]);

    // Check if the reason codes were added successfully
    expect(await mocaPoints.connect(signer).allowedConsumeReasonCodes(reasonCode1)).to.equal(true);
    expect(await mocaPoints.connect(signer).allowedConsumeReasonCodes(reasonCode2)).to.equal(true);
  });

  // Test for BatchRemovedConsumeReasonCode event
  it('Should emit BatchRemovedConsumeReasonCode event', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await mocaPoints.connect(signer).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);

    // Check if the reason codes were added successfully
    expect(await mocaPoints.connect(signer).allowedConsumeReasonCodes(reasonCode1)).to.equal(true);
    expect(await mocaPoints.connect(signer).allowedConsumeReasonCodes(reasonCode2)).to.equal(true);

    expect(await mocaPoints.connect(signer).batchRemoveConsumeReasonCodes([reasonCode1, reasonCode2]))
      .to.emit(mocaPoints, 'BatchRemovedConsumeReasonCode')
      .withArgs(reasonCode1, reasonCode2);
  });

  it('should emit Consumed event when consuming tokens with realmId, amount and reasonCode', async function () {
    const name = 'xyz';
    const parentNode = ethers.encodeBytes32String('node');
    const consumeReasonCode = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(signer).batchAddConsumeReasonCodes([consumeReasonCode]);
    const currentSeason = mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = mockRealmContract.burnCounts(realmId);
    const nonce = await mocaPoints.nonces(realmId);
    const amount = 10;
    await mocaPoints.connect(signer).grantRole(DEPOSITOR_ROLE, depositor);
    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, consumeReasonCode);

    expect(await mocaPoints.connect(signer)['consume(uint256,uint256,bytes32)'](realmId, amount, consumeReasonCode))
      .to.emit('mocaPoints', 'Consumed')
      .withArgs(realmId, currentSeason, consumeReasonCode, signer.address, realmIdVersion, amount, signer.address, nonce);
  });

  it('should emit Consumed event when consuming tokens with parentNode, name, amount and reasonCode', async function () {
    const name = 'xyz';
    const parentNode = ethers.encodeBytes32String('node');
    const consumeReasonCode = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(signer).batchAddConsumeReasonCodes([consumeReasonCode]);
    const currentSeason = mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = mockRealmContract.burnCounts(realmId);
    const nonce = await mocaPoints.nonces(realmId);
    const amount = 10;
    await mocaPoints.connect(signer).grantRole(DEPOSITOR_ROLE, depositor);
    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, consumeReasonCode);

    expect(await mocaPoints.connect(signer)['consume(bytes32,string,uint256,bytes32)'](parentNode, name, amount, consumeReasonCode))
      .to.emit('mocaPoints', 'Consumed')
      .withArgs(realmId, currentSeason, consumeReasonCode, signer.address, realmIdVersion, amount, signer.address, nonce);
  });

  it('should emit Consumed event when consuming tokens with realmId, amount and reasonCode and verify signature', async function () {
    const consumeReasonCode = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(signer).batchAddConsumeReasonCodes([consumeReasonCode]);
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'xyz';
    const currentSeason = await mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const nonce = await mocaPoints.nonces(realmId);
    const realmIdVersion = await mockRealmContract.burnCounts(realmId);
    const amount = 20;
    await mocaPoints.connect(signer).grantRole(DEPOSITOR_ROLE, depositor);
    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, consumeReasonCode);

    // Create a unique message to sign
    const message = ethers.solidityPackedKeccak256(
      ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
      [realmId, realmIdVersion, amount, currentSeason, consumeReasonCode, nonce]
    );
    const signature = await signer.signMessage(ethers.getBytes(message));
    const {v, r, s} = ethers.Signature.from(signature);
    expect(await mocaPoints.connect(depositor)['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](realmId, amount, consumeReasonCode, v, r, s))
      .to.emit('mocaPoints', 'Consumed')
      .withArgs(realmId, currentSeason, consumeReasonCode, signer.address, realmIdVersion, amount, signer.address, nonce);
  });

  it('should consume tokens with parent node and verify the signature', async function () {
    const consumeReasonCode = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(signer).batchAddConsumeReasonCodes([consumeReasonCode]);

    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'xyz';
    const currentSeason = await mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const nonce = await mocaPoints.nonces(realmId);
    const realmIdVersion = await mockRealmContract.burnCounts(realmId);
    const amount = 20;

    await mocaPoints.connect(signer).grantRole(DEPOSITOR_ROLE, depositor);
    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, consumeReasonCode);

    //   // Get the initial balance of the realmId
    //   const initialBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));

    // Create a unique message to sign
    const message = ethers.solidityPackedKeccak256(
      ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
      [realmId, realmIdVersion, amount, currentSeason, consumeReasonCode, nonce]
    );

    const signature = await signer.signMessage(ethers.getBytes(message));
    const {v, r, s} = ethers.Signature.from(signature);

    expect(
      await mocaPoints
        .connect(depositor)
        ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, name, amount, consumeReasonCode, v, r, s)
    )
      .to.emit('mocaPoints', 'Consumed')
      .withArgs(realmId, currentSeason, consumeReasonCode, signer.address, realmIdVersion, amount, signer.address, nonce);
  });

  it('Should emit Deposited event with parentNode and name', async function () {
    const reasonCode = ethers.encodeBytes32String('reason');
    const season = ethers.encodeBytes32String('season');
    const parentNode = ethers.encodeBytes32String('moca');
    const name = 'xyz';
    const amount = 100;

    // const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmId = await mockRealmContract['getTokenId(string, bytes32)'](name, parentNode);
    const realmIdVersion = Number(await mockRealmContract.burnCounts(realmId));
    await mocaPoints.connect(signer).grantRole(DEPOSITOR_ROLE, depositor);

    expect(
      await mocaPoints
        .connect(depositor)
        ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](season, parentNode, name, realmIdVersion, amount, reasonCode)
    )
      .to.emit(mocaPoints, 'Deposited')
      .withArgs(owner.address, season, reasonCode, realmId, realmIdVersion, amount);
  });

  it('Should emit Deposited event with realmId', async function () {
    const reasonCode = ethers.encodeBytes32String('reason');
    const season = ethers.encodeBytes32String('season');
    const parentNode = ethers.encodeBytes32String('moca');
    const name = 'xyz';
    const amount = 100;

    // const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmId = await mockRealmContract['getTokenId(string, bytes32)'](name, parentNode);
    const realmIdVersion = Number(await mockRealmContract.burnCounts(realmId));
    await mocaPoints.connect(signer).grantRole(DEPOSITOR_ROLE, depositor);

    expect(
      await mocaPoints.connect(depositor)['deposit(bytes32,uint256,uint256,uint256,bytes32)'](season, realmId, realmIdVersion, amount, reasonCode)
    )
      .to.emit(mocaPoints, 'Deposited')
      .withArgs(owner.address, season, reasonCode, realmId, realmIdVersion, amount);
  });
});
