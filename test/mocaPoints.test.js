/* eslint-disable mocha/no-identical-title */
const {expect} = require('chai');
const {BigNumber} = require('ethers');
const {ethers, upgrades} = require('hardhat');
// const {deploy, save} = deployments;
require('dotenv').config();

describe('MocaPoints-Test', function () {
  let depositor, consumer, recipient, signer, other, ADMIN_ROLE, DEPOSITOR_ROLE, PAUSER_ROLE, UPGRADER_ROLE, DEFAULT_ADMIN_ROLE;
  let mocaPoints;
  let realmContract;

  beforeEach(async function () {
    [depositor, payoutWallet, recipient, signer, owner, other] = await ethers.getSigners();
    const name = 'bishal';
    const parentNode = ethers.encodeBytes32String('parentNode1');

    const RealmId = await ethers.getContractFactory('RealmId');
    realmContract = await upgrades.deployProxy(RealmId, ['TOKEN', 'TKN', signer.address], {initializer: 'initialize'});
    const realmContractAddress = realmContract.target;
    // console.log('owner and depositor', await realmContract.owner(), signer.address);

    const MocaPoints = await ethers.getContractFactory('MocaPoints');
    mocaPoints = await upgrades.deployProxy(MocaPoints, [realmContractAddress, signer.address], {initializer: 'initialize'});
    ADMIN_ROLE = await mocaPoints.ADMIN_ROLE();
    DEPOSITOR_ROLE = await mocaPoints.DEPOSITOR_ROLE();
    PAUSER_ROLE = await mocaPoints.PAUSER_ROLE();
    UPGRADER_ROLE = await mocaPoints.UPGRADER_ROLE();
  });

  it('should set ADMIN Role correctly', async function () {
    const isAdmin = await mocaPoints.hasRole(ADMIN_ROLE, signer.address);
    expect(isAdmin).to.equal(true);
  });

  it('should set DEPOSITOR Role correctly', async function () {
    const isAdmin = await mocaPoints.hasRole(DEPOSITOR_ROLE, signer.address);
    expect(isAdmin).to.equal(true);
  });

  it('should set PAUSER Role correctly', async function () {
    const isAdmin = await mocaPoints.hasRole(PAUSER_ROLE, signer.address);
    expect(isAdmin).to.equal(true);
  });

  it('should set UPGRADER Role correctly', async function () {
    const isAdmin = await mocaPoints.hasRole(UPGRADER_ROLE, signer.address);
    expect(isAdmin).to.equal(true);
  });

  it('should set and prevent setting an existing season', async function () {
    const newSeason = ethers.encodeBytes32String('Season1');
    expect(await mocaPoints.connect(signer).currentSeason()).to.not.equal(newSeason);
    await mocaPoints.connect(signer).setCurrentSeason(newSeason);
    expect(await mocaPoints.connect(signer).currentSeason()).to.equal(newSeason);

    // Attempt to set the same season again, should revert
    await expect(mocaPoints.connect(signer).setCurrentSeason(newSeason)).to.be.revertedWith('Season already set');
  });
  // it('should emit SetCurrentSeason event when setting a new season', async function () {
  //   const newSeason = ethers.encodeBytes32String('Season1');
  //   await expect(mocaPoints.connect(signer).setCurrentSeason(newSeason)).to.emit('SetCurrentSeason').withArgs(newSeason);
  // });

  // working
  it('should add and prevent adding duplicate reason codes', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await mocaPoints.connect(signer).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);

    // Check if the reason codes were added successfully
    expect(await mocaPoints.connect(signer).isReasonCodeAllowed(reasonCode1)).to.equal(true);
    expect(await mocaPoints.connect(signer).isReasonCodeAllowed(reasonCode2)).to.equal(true);

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
    expect(await mocaPoints.connect(signer).isReasonCodeAllowed(reasonCode1)).to.equal(false);
  });

  // DEPOSIT TEST

  it('should deposit tokens and update balances correctly with deposit function', async function () {
    const reasonCode1 = ethers.encodeBytes32String('reason');
    const season = ethers.encodeBytes32String('season');
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'bishal';
    const amount = 100;

    const realmId = await realmContract.getTokenId(name, parentNode);
    const realmIdVersion = await realmContract.burnCounts(realmId);
    // Call the contract function and wait for the result
    const balance = Number(await mocaPoints.connect(signer).balanceOfWithSeasonRealmId(season, realmId));

    // Deposit tokens for an account
    await mocaPoints.connect(signer).deposit(season, realmId, realmIdVersion, amount, reasonCode1);

    // After depositing, get the updated balance for the same account
    const updatedBalance = await mocaPoints.connect(signer).balanceOfWithSeasonRealmId(season, realmId);
    const finalbalance = balance + 100;

    // Check that the balance increased by the deposited amount
    expect(updatedBalance).to.equal(finalbalance);
  });

  it('should deposit tokens and update balances correctly with depositWithParentnode function', async function () {
    const reasonCode = ethers.encodeBytes32String('reason');
    const season = ethers.encodeBytes32String('season');
    const parentNode = ethers.encodeBytes32String('moca');
    const name = 'bishal';
    const amount = 100;

    // const preData = ethers.toUtf8Bytes('data');
    // const label = 'bist';

    const realmId = await realmContract.getTokenId(name, parentNode);
    const realmIdVersion = await realmContract.burnCounts(realmId);
    // console.log('realmId and realmIdVersion:', realmId, realmIdVersion);
    // Call the contract function and wait for the result
    const balance = Number(await mocaPoints.connect(signer).balanceOfWithSeasonRealmId(season, realmId));
    // const val = await realmContract.available(name, parentNode);
    // console.log('available= ', val);

    // Deposit tokens for an account
    await mocaPoints.connect(signer).depositWithParentnode(season, parentNode, name, realmIdVersion, amount, reasonCode);

    // After depositing, get the updated balance for the same account
    const updatedBalance = await mocaPoints.connect(signer).balanceOfWithSeasonRealmId(season, realmId);
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
    const realmId = await realmContract.getTokenId(name, parentNode);
    const realmIdVersion = realmContract.burnCounts(realmId);
    const balance = Number(await mocaPoints.balanceOfWithSeasonRealmId(season, realmId));
    await mocaPoints.connect(signer).deposit(season, realmId, realmIdVersion, amount, reasonCode);
    const updatedBalance = Number(await mocaPoints.balanceOfWithSeasonRealmId(season, realmId));
    const expectedBalance = balance + 100;

    expect(updatedBalance).to.equal(expectedBalance);
  });

  it('should return the balance of a realmId for a specific season, parentnode and name', async function () {
    const season = ethers.encodeBytes32String('season');
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'bishal';
    const amount = 100;
    const reasonCode = ethers.encodeBytes32String('reason');
    const realmId = await realmContract.getTokenId(name, parentNode);
    const realmIdVersion = realmContract.burnCounts(realmId);
    const balance = Number(await mocaPoints.balanceOfWithSeason(season, parentNode, name));
    await mocaPoints.connect(signer).deposit(season, realmId, realmIdVersion, amount, reasonCode);
    const updatedBalance = Number(await mocaPoints.balanceOfWithSeason(season, parentNode, name));

    const expectedBalance = balance + 100;

    expect(updatedBalance).to.equal(expectedBalance);
  });

  it('should return the balance of a realmId for the current season', async function () {
    const currentSeason = mocaPoints.currentSeason();
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'bishal';
    const amount = 100;
    const reasonCode = ethers.encodeBytes32String('reason');
    const realmId = await realmContract.getTokenId(name, parentNode);
    const realmIdVersion = realmContract.burnCounts(realmId);
    const balance = Number(await mocaPoints.balanceOfWithRealmId(realmId));
    await mocaPoints.connect(signer).deposit(currentSeason, realmId, realmIdVersion, amount, reasonCode);
    const updatedBalance = Number(await mocaPoints.balanceOfWithRealmId(realmId));

    const expectedBalance = balance + 100;

    expect(updatedBalance).to.equal(expectedBalance);
  });

  it('should return the balance of a realmId for the current season with a given parent node and name', async function () {
    const currentSeason = mocaPoints.currentSeason();
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'bishal';
    const amount = 100;
    const reasonCode = ethers.encodeBytes32String('reason');
    const realmId = await realmContract.getTokenId(name, parentNode);
    const realmIdVersion = realmContract.burnCounts(realmId);
    const balance = Number(await mocaPoints.balanceOfWithParentNodeName(parentNode, name));
    await mocaPoints.connect(signer).deposit(currentSeason, realmId, realmIdVersion, amount, reasonCode);
    const updatedBalance = Number(await mocaPoints.connect(signer).balanceOfWithParentNodeName(parentNode, name));
    const expectedBalance = balance + 100;

    expect(updatedBalance).to.equal(expectedBalance);
  });

  // CONSUME TEST

  // it('should consume tokens with parent node', async function () {
  //   const parentNode = ethers.encodeBytes32String('moca');
  //   // const preData = ethers.toUtf8Bytes('data');
  //   const name = 'bishal';
  //   // const val = await realmContract.available(name, parentNode);
  //   // console.log('val:', val);

  //   const preData = ethers.toUtf8Bytes('data');
  //   const label = 'bist';
  //   const middlewaredata = ethers.toUtf8Bytes('middleware');
  //   const middlewareAddr = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
  //   const allow = true;
  //   const baseTokenURI = '/abc';
  //   const amount = 10;
  //   // Register a realmId for the test
  //   console.log('allowed:', await realmContract.allowedParentNodes(parentNode));
  //   await realmContract.connect(signer).allowNode(label, parentNode, allow, baseTokenURI, middlewareAddr, middlewaredata);
  //   await realmContract.register(name, parentNode, owner.address, preData);

  //   // Get the realmId for the registered name and parent node
  //   const realmId = await realmContract.getTokenId(name, parentNode);

  //   // Get the initial balance of the realmId
  //   const initialBalance = await mocaPoints.balanceOfWithRealmId(realmId);

  //   // Perform the consumption using the consumeWithParentnode function
  //   await mocaPoints.connect(consumer).consumeWithParentnode(parentNode, name, amount, consumeReasonCode);

  //   // Get the updated balance of the realmId after consumption
  //   const updatedBalance = await mocaPoints.balanceOfWithRealmId(realmId);
  //   const finalbalance = initialBalance - amount;

  //   // Check that the balance decreased by the consumed amount
  //   expect(updatedBalance).to.equal(finalbalance);
  // });

  // it('should consume tokens with realmId', async function () {
  //   const name = 'bishal';
  //   const val = await realmContract.available(name, parentNode);
  //   console.log('val:', val);

  //   const preData = ethers.toUtf8Bytes('data');
  //   const label = 'bist';
  //   const middlewaredata = ethers.toUtf8Bytes('middleware');
  //   const middlewareAddr = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
  //   const allow = true;
  //   const baseTokenURI = '/abc';
  //   const amount = 10;
  //   // Register a realmId for the test
  //   await realmContract.register(name, parentNode, owner.address, preData);
  //   await realmContract.allowNode(label, parentNode, allow, baseTokenURI, middlewareAddr, middlewaredata);

  //   // Get the realmId for the registered name and parent node
  //   const realmId = await realmContract.getTokenId(name, parentNode);

  //   // Get the initial balance of the realmId
  //   const initialBalance = await mocaPoints.balanceOfWithRealmId(realmId);

  //   // Perform the consumption using the consumeWithRealmId function
  //   await mocaPoints.connect(consumer).consumeWithRealmId(realmId, amount, consumeReasonCode);

  //   // Get the updated balance of the realmId after consumption
  //   const updatedBalance = await mocaPoints.balanceOfWithRealmId(realmId);
  //   const finalbalance = initialBalance - amount;

  //   // Check that the balance decreased by the consumed amount
  //   expect(updatedBalance).to.equal(finalbalance);
  // });

  // it('should consume tokens with parent node and verify the signature', async function () {
  //   const consumeReasonCode = ethers.encodeBytes32String('reason');
  //   const parentNode = ethers.encodeBytes32String('parentNode');
  //   const name = 'bishal';
  //   const currentSeason = await mocaPoints.currentSeason();
  //   const nonce = await mocaPoints.nonces[realmId];
  //   const realmIdVersion = await realmContract.burnCounts(realmId);
  //   const amount = 10;
  //   // Get the realmId for the registered name and parent node
  //   const realmId = await realmContract.getTokenId(name, parentNode);

  //   // Get the initial balance of the realmId
  //   const initialBalance = await mocaPoints.balanceOfWithRealmId(realmId);

  //   // Create a unique message to sign
  //   const message = ethers.keccak256(
  //     new Uint8Array(
  //       ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
  //       [realmId, realmIdVersion, amount, currentSeason, consumeReasonCode, nonce]
  //     )
  //   );

  //   // Sign the message with the consumer's private key
  //   const signature = await signer.signMessage(ethers.utils.arrayify(message));
  //   const {v, r, s} = ethers.Signature.from(signature);

  //   // Perform the consumption using consumeWithParentnodeVRS and verify the signature
  //   await mocaPoints.consumeWithParentnodeVRS(parentNode, name, amount, consumeReasonCode, v, r, s);

  //   // Get the updated balance of the realmId after consumption
  //   const updatedBalance = await mocaPoints.balanceOfWithRealmId(realmId);
  //   const finalbalance = initialBalance - amount;

  //   // Check that the balance decreased by the consumed amount
  //   expect(updatedBalance).to.equal(finalbalance);
  // });

  // it('should consume tokens with realmId and verify the signature', async function () {
  //   const consumeReasonCode = ethers.encodeBytes32String('reason');
  //   const parentNode = ethers.encodeBytes32String('parentNode');
  //   const name = 'bishal';
  //   const currentSeason = await mocaPoints.currentSeason();
  //   const nonce = await mocaPoints.nonces[realmId];
  //   const realmIdVersion = await realmContract.burnCounts(realmId);
  //   const realmId = await realmContract.getTokenId(name, parentNode);
  //   const amount = 10;

  //   // Get the initial balance of the realmId
  //   const initialBalance = await mocaPoints.balanceOfWithRealmId(realmId);

  //   // Create a unique message to sign
  //   const message = ethers.keccak256(
  //     new Uint8Array(
  //       ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
  //       [realmId, realmIdVersion, amount, currentSeason, consumeReasonCode, nonce]
  //     )
  //   );

  //   // Sign the message with the consumer's private key
  //   const signature = await signer.signMessage(ethers.utils.arrayify(message));
  //   const {v, r, s} = ethers.Signature.from(signature);

  //   // Perform the consumption using consumeWithParentnodeVRS and verify the signature
  //   await mocaPoints.consumeWithRealmIdVRS(realmId, amount, consumeReasonCode, v, r, s);

  //   // Get the updated balance of the realmId after consumption
  //   const updatedBalance = await mocaPoints.balanceOfWithRealmId(realmId);
  //   const finalbalance = initialBalance - amount;

  //   // Check that the balance decreased by the consumed amount
  //   expect(updatedBalance).to.equal(finalbalance);
  // });

  // PREPARE PAYLOAD
  it('should prepare the payload', async function () {
    // Calculate the expected payload using the same logic as in the contract
    const consumeReasonCode = ethers.encodeBytes32String('reason');
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'bishal';
    const realmId = await realmContract.getTokenId(name, parentNode);
    const amount = 10;

    await mocaPoints.preparePayload(realmId, amount, consumeReasonCode);
  });

  it('should revert when non-depositor attempts to deposit', async function () {
    const season = ethers.encodeBytes32String('season');
    const depositReasonCode = ethers.encodeBytes32String('reason');
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'bishal';
    const amount = 100;
    const realmId = await realmContract.getTokenId(name, parentNode);
    const realmIdVersion = realmContract.burnCounts(realmId);
    await mocaPoints.connect(signer).deposit(season, realmId, realmIdVersion, amount, depositReasonCode);

    // Attempt to deposit without having the DEPOSITOR_ROLE, should revert
    await expect(mocaPoints.connect(other).deposit(season, realmId, realmIdVersion, amount, depositReasonCode)).to.be.revertedWith('Not a depositor');
  });
});
