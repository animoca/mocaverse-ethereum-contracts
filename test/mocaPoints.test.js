/* eslint-disable max-len */
/* eslint-disable mocha/no-identical-title */
const {expect} = require('chai');
const {BigNumber} = require('ethers');
const {ethers, upgrades} = require('hardhat');
require('dotenv').config();

describe('MocaPoints-Test', function () {
  let depositor, recipient, signer, other, DEPOSITOR_ROLE, PAUSER_ROLE, UPGRADER_ROLE;
  let mocaPoints;
  let mockRealmContract;

  beforeEach(async function () {
    [depositor, payoutWallet, recipient, signer, owner, other] = await ethers.getSigners();

    const RealmId = await ethers.getContractFactory('MockRealmId');
    mockRealmContract = await upgrades.deployProxy(RealmId, ['TOKEN', 'TKN', signer.address], {initializer: 'initialize'});
    const mockRealmContractAddress = mockRealmContract.target;

    const MocaPoints = await ethers.getContractFactory('MocaPoints');
    mocaPoints = await upgrades.deployProxy(MocaPoints, [mockRealmContractAddress, signer.address], {initializer: 'initialize'});
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

  // // DEPOSIT TEST

  it('should deposit tokens and update balances correctly with deposit function', async function () {
    const reasonCode = ethers.encodeBytes32String('reason');
    const season = ethers.encodeBytes32String('season');
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'bishal';
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
    const name = 'bishal';
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
    const name = 'bishal';
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
    const name = 'bishal';
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
    const name = 'bishal';
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
    const name = 'bishal';
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

  // CONSUME TEST
  it('should consume tokens with parent node and verify the signature', async function () {
    const reasonCode = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(signer).batchAddConsumeReasonCodes([reasonCode]);
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'bishal';
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
    const name = 'bishal';
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
    const name = 'bishal';
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
    const name = 'bishal';
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
});
