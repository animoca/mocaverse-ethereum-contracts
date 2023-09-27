/* eslint-disable max-len */
/* eslint-disable mocha/no-identical-title */
const {expect} = require('chai');
const {ethers, upgrades} = require('hardhat');

describe('MocaPoints-Test', function () {
  const ADMIN_ROLE = '0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775';
  const DEPOSITOR_ROLE = '0x8f4f2da22e8ac8f11e15f9fc141cddbb5deea8800186560abb6e68c5496619a9';

  let owner, admin, depositor, other;
  let mocaPoints;
  let mockRealmContract;

  beforeEach(async function () {
    [owner, admin, depositor, consumer, other] = await ethers.getSigners();

    const realmIdContract = await ethers.getContractFactory('MockRealmId');
    mockRealmContract = await realmIdContract.deploy();

    const MocaPoints = await ethers.getContractFactory('MocaPoints');
    mocaPoints = await upgrades.deployProxy(MocaPoints, [mockRealmContract.target, owner.address], {initializer: 'initialize', kind: 'uups'});
  });

  it('should set current season', async function () {
    const newSeason = ethers.encodeBytes32String('Season1');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).setCurrentSeason(newSeason);
    expect(await mocaPoints.connect(admin).currentSeason()).to.equal(newSeason);
  });

  it('Should emit SetCurrentSeason event', async function () {
    const newSeason = ethers.encodeBytes32String('SEASON_ID_1');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);

    const tx = await mocaPoints.connect(admin).setCurrentSeason(newSeason);
    const receipt = await tx.wait();
    // console.log('receipt: ', receipt);
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('SetCurrentSeason');
    expect(args).to.deep.equal([newSeason]);
  });

  it('should prevent setting an existing season', async function () {
    const newSeason = ethers.encodeBytes32String('Season1');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).setCurrentSeason(newSeason);

    await expect(mocaPoints.connect(admin).setCurrentSeason(newSeason)).to.be.revertedWith('Season already set');
  });

  it('should add ReasonCodes', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);

    expect(await mocaPoints.allowedConsumeReasonCodes(reasonCode1)).to.equal(true);
    expect(await mocaPoints.allowedConsumeReasonCodes(reasonCode2)).to.equal(true);
  });

  it('Should emit BatchAddConsumeReasonCode event', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);

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

  it('should revert on adding exixting ReasonCodes', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);
    await expect(mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1])).to.be.revertedWith('Reason code already exists');
  });

  it('should remove reason codes correctly', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);

    await mocaPoints.connect(admin).batchRemoveConsumeReasonCodes([reasonCode1, reasonCode2]);

    expect(await mocaPoints.connect(admin).allowedConsumeReasonCodes(reasonCode1)).to.equal(false);
  });

  it('Should emit BatchRemovedConsumeReasonCode event', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);

    const tx = await mocaPoints.connect(admin).batchRemoveConsumeReasonCodes([reasonCode1, reasonCode2]);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('BatchRemovedConsumeReasonCode');
    const actualReasonCodes = args.reasonCodes;
    expect(actualReasonCodes).to.deep.equal([reasonCode1, reasonCode2]);
  });

  it('should deposit tokens and update balances correctly with deposit function for parentNode and name', async function () {
    const reasonCode = ethers.encodeBytes32String('reason');
    const season = ethers.encodeBytes32String('season');
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'xyz';
    const amount = 100;

    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = await mockRealmContract.burnCounts(realmId);
    // Call the contract function for the initial balance
    const balance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId));
    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);

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
    const reasonCode = ethers.encodeBytes32String('reason');
    const season = ethers.encodeBytes32String('season');
    const parentNode = ethers.encodeBytes32String('moca');
    const name = 'xyz';
    const amount = 100;
    const realmId = await mockRealmContract['getTokenId(string, bytes32)'](name, parentNode);
    const realmIdVersion = await mockRealmContract.burnCounts(realmId);
    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);

    const tx = await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](season, parentNode, name, realmIdVersion, amount, reasonCode);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('Deposited');
    expect(args).to.deep.equal([depositor.address, season, reasonCode, realmId, realmIdVersion, amount]);
  });

  it('should deposit tokens and update balances correctly with deposit for season and realmId', async function () {
    const reasonCode = ethers.encodeBytes32String('reason');
    const season = ethers.encodeBytes32String('season');
    const parentNode = ethers.encodeBytes32String('moca');
    const name = 'xyz';
    const amount = 100;
    const realmId = await mockRealmContract['getTokenId(string, bytes32)'](name, parentNode);
    const realmIdVersion = Number(await mockRealmContract.burnCounts(realmId));
    const balance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId));
    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);

    await mocaPoints.connect(depositor)['deposit(bytes32,uint256,uint256,uint256,bytes32)'](season, realmId, realmIdVersion, amount, reasonCode);
    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId));
    const finalbalance = balance + 100;

    expect(updatedBalance).to.equal(finalbalance);
  });

  it('Should emit Deposited event with realmId', async function () {
    const reasonCode = ethers.encodeBytes32String('reason');
    const season = ethers.encodeBytes32String('season');
    const parentNode = ethers.encodeBytes32String('moca');
    const name = 'xyz';
    const amount = 100;
    const realmId = await mockRealmContract['getTokenId(string, bytes32)'](name, parentNode);
    const realmIdVersion = Number(await mockRealmContract.burnCounts(realmId));
    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);

    const tx = await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](season, realmId, realmIdVersion, amount, reasonCode);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('Deposited');
    expect(args).to.deep.equal([depositor.address, season, reasonCode, realmId, realmIdVersion, amount]);
  });

  it('should consume tokens with parent node and verify the signature', async function () {
    const reasonCode = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode]);
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'xyz';
    const currentSeason = await mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const nonce = await mocaPoints.nonces(realmId);
    const realmIdVersion = await mockRealmContract.burnCounts(realmId);
    const amount = 20;

    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);

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
    const consumeReasonCode = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([consumeReasonCode]);

    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'xyz';
    const currentSeason = await mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const nonce = await mocaPoints.nonces(realmId);
    const realmIdVersion = await mockRealmContract.burnCounts(realmId);
    const amount = 20;

    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);
    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, consumeReasonCode);

    // Create a unique message to sign
    const message = ethers.solidityPackedKeccak256(
      ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
      [realmId, realmIdVersion, amount, currentSeason, consumeReasonCode, nonce]
    );

    const signature = await consumer.signMessage(ethers.getBytes(message));
    const {v, r, s} = ethers.Signature.from(signature);

    const tx = await mocaPoints
      .connect(consumer)
      ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, name, amount, consumeReasonCode, v, r, s);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('Consumed');
    expect(args).to.deep.equal([realmId, currentSeason, consumeReasonCode, consumer.address, realmIdVersion, amount, consumer.address]);
  });

  it('should consume tokens with realmId and verify the signature', async function () {
    const reasonCode = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode]);
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'xyz';
    const currentSeason = await mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const nonce = await mocaPoints.nonces(realmId);
    const realmIdVersion = await mockRealmContract.burnCounts(realmId);
    const amount = 20;

    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);
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
    const consumeReasonCode = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([consumeReasonCode]);
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'xyz';
    const currentSeason = await mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = await mockRealmContract.burnCounts(realmId);
    const amount = 20;
    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);
    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](currentSeason, realmId, realmIdVersion, amount, consumeReasonCode);

    const nonce = await mocaPoints.nonces(realmId);
    // Create a unique message to sign
    const message = ethers.solidityPackedKeccak256(
      ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
      [realmId, realmIdVersion, amount, currentSeason, consumeReasonCode, nonce]
    );
    const signature = await consumer.signMessage(ethers.getBytes(message));
    // const signature = new ethers.SigningKey('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6').sign(
    //   ethers.getBytes(ethers.solidityPackedKeccak256(['string', 'bytes32'], ['custom-prefix-MocaPoints', message]))
    // );
    const {v, r, s} = ethers.Signature.from(signature);

    const tx = await mocaPoints
      .connect(consumer)
      ['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](realmId, amount, consumeReasonCode, v, r, s);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('Consumed');
    expect(args).to.deep.equal([realmId, currentSeason, consumeReasonCode, consumer.address, realmIdVersion, amount, consumer.address]);
  });

  it('should consume tokens with parent node', async function () {
    const parentNode = ethers.encodeBytes32String('node');
    const name = 'xyz';
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1]);
    const currentSeason = mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = mockRealmContract.burnCounts(realmId);
    const amount = 10;

    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);
    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode1);

    const initialBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));
    await mocaPoints.connect(consumer)['consume(bytes32,string,uint256,bytes32)'](parentNode, name, amount, reasonCode1);

    // Get the updated balance of the realmId after consumption
    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));
    const finalbalance = initialBalance - amount;

    // Check that the balance decreased by the consumed amount
    expect(updatedBalance).to.equal(finalbalance);
  });

  it('should emit Consumed event when consuming tokens with parentNode, name, amount and reasonCode', async function () {
    const name = 'xyz';
    const parentNode = ethers.encodeBytes32String('node');
    const consumeReasonCode = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([consumeReasonCode]);
    const currentSeason = await mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = await mockRealmContract.burnCounts(realmId);
    const amount = 10;
    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);
    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, consumeReasonCode);

    const tx = await mocaPoints.connect(consumer)['consume(bytes32,string,uint256,bytes32)'](parentNode, name, amount, consumeReasonCode);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('Consumed');
    expect(args).to.deep.equal([realmId, currentSeason, consumeReasonCode, consumer.address, realmIdVersion, amount, consumer.address]);
  });

  it('should consume tokens with realmId', async function () {
    const name = 'xyz';
    const parentNode = ethers.encodeBytes32String('node');
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1]);
    const currentSeason = mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = mockRealmContract.burnCounts(realmId);
    const amount = 10;
    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode1);
    // Get the initial balance of the realmId
    const initialBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));

    await mocaPoints.connect(consumer)['consume(uint256,uint256,bytes32)'](realmId, amount, reasonCode1);

    // Get the updated balance of the realmId after consumption
    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));
    const finalbalance = initialBalance - amount;

    // Check that the balance decreased by the consumed amount
    expect(updatedBalance).to.equal(finalbalance);
  });

  it('should emit Consumed event when consuming tokens with realmId, amount and reasonCode', async function () {
    const name = 'xyz';
    const parentNode = ethers.encodeBytes32String('node');
    const consumeReasonCode = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([consumeReasonCode]);
    const currentSeason = await mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = await mockRealmContract.burnCounts(realmId);
    const amount = 10;
    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);
    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, consumeReasonCode);

    const tx = await mocaPoints.connect(consumer)['consume(uint256,uint256,bytes32)'](realmId, amount, consumeReasonCode);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('Consumed');
    expect(args).to.deep.equal([realmId, currentSeason, consumeReasonCode, consumer.address, realmIdVersion, amount, consumer.address]);
  });

  it('should not allow a non-owner to consume tokens with realmId and verify the signature', async function () {
    const reasonCode = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode]);
    const parentNode = ethers.encodeBytes32String('parentNode');
    const name = 'xyz';
    const currentSeason = await mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const nonce = await mocaPoints.nonces(realmId);
    const realmIdVersion = await mockRealmContract.burnCounts(realmId);
    const amount = 20;

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
    const name = 'xyz';
    const parentNode = ethers.encodeBytes32String('node');
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1]);
    const currentSeason = mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = mockRealmContract.burnCounts(realmId);
    const amount = 10;
    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode1);

    await expect(mocaPoints.connect(other)['consume(uint256,uint256,bytes32)'](realmId, amount, reasonCode1)).to.be.revertedWith(
      'Sender is not the owner'
    );
  });

  it('should not allow to consume tokens with insufficient balance', async function () {
    const name = 'xyz';
    const parentNode = ethers.encodeBytes32String('node');
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1]);
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const amount = 10;
    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);

    await expect(mocaPoints.connect(consumer)['consume(uint256,uint256,bytes32)'](realmId, amount, reasonCode1)).to.be.revertedWith(
      'Insufficient balance'
    );
  });

  it('should not allow to consume tokens with invalid consume reason code', async function () {
    const name = 'xyz';
    const parentNode = ethers.encodeBytes32String('node');
    const invalidconsumereasonCode = ethers.encodeBytes32String('Reason2');
    const reasonCode = ethers.encodeBytes32String('Reason1');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode]);
    const currentSeason = mocaPoints.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = mockRealmContract.burnCounts(realmId);
    const amount = 10;
    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);

    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode);

    await expect(mocaPoints.connect(consumer)['consume(uint256,uint256,bytes32)'](realmId, amount, invalidconsumereasonCode)).to.be.revertedWith(
      'Invalid consume reason code'
    );
  });

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

    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);

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

    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);

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

    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);

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

    await mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);
    await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode);

    const updatedBalance = Number(await mocaPoints.connect(depositor)['balanceOf(bytes32,string)'](parentNode, name));

    const expectedBalance = balance + 100;

    expect(updatedBalance).to.equal(expectedBalance);
  });

  it('should prepare the payload correctly', async function () {
    const reasonCode = ethers.encodeBytes32String('reason');
    const parentNode = ethers.encodeBytes32String('moca');
    const name = 'xyz';
    const amount = 100;
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const currentSeason = await mocaPoints.currentSeason();
    const realmIdVersion = Number(await mockRealmContract.burnCounts(realmId));
    const nonce = await mocaPoints.nonces(realmId);

    const payload = await mocaPoints.preparePayload(realmId, amount, reasonCode);

    const expectedPayload = ethers.solidityPackedKeccak256(
      ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
      [realmId, realmIdVersion, amount, currentSeason, reasonCode, nonce]
    );
    // Check that the prepared payload matches the expected payload
    expect(payload).to.equal(expectedPayload);
  });

  it('should not allow re-initialization', async function () {
    const mockRealmIdContract = mockRealmContract.target;
    const owner_ = owner.address;
    // Attempt to initialize the contract again, it should revert
    await expect(mocaPoints.initialize(mockRealmIdContract, owner_)).to.be.revertedWith('Initializable: contract is already initialized');
  });
});

describe('Upgradeability-Test', function () {
  const ADMIN_ROLE = '0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775';
  const DEPOSITOR_ROLE = '0x8f4f2da22e8ac8f11e15f9fc141cddbb5deea8800186560abb6e68c5496619a9';

  let owner, admin, depositor, other;
  let mocaPoints, MocaPointsV2, mocaPointsV2;
  let mockRealmContract;

  beforeEach(async function () {
    [owner, admin, depositor, consumer, other] = await ethers.getSigners();

    const realmIdContract = await ethers.getContractFactory('MockRealmId');
    mockRealmContract = await realmIdContract.deploy();

    const MocaPoints = await ethers.getContractFactory('MocaPoints');
    MocaPointsV2 = await ethers.getContractFactory('MocaPointsV2');
    mocaPoints = await upgrades.deployProxy(MocaPoints, [mockRealmContract.target, owner.address], {initializer: 'initialize', kind: 'uups'});
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);
    mocaPointsV2 = await upgrades.upgradeProxy(mocaPoints.target, MocaPointsV2.connect(admin));
  });

  it('should set current season', async function () {
    const newSeason = ethers.encodeBytes32String('Season1');
    await mocaPointsV2.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPointsV2.connect(admin).setCurrentSeason(newSeason);
    expect(await mocaPointsV2.currentSeason()).to.equal(ethers.solidityPackedKeccak256(['bytes32'], [newSeason]));
  });

  it('Should emit SetCurrentSeason event', async function () {
    const newSeason = ethers.encodeBytes32String('SEASON_ID_1');
    await mocaPointsV2.connect(owner).grantRole(ADMIN_ROLE, admin);
    // console.log('hashed current season: ', ethers.solidityPackedKeccak256(['bytes32'], [newSeason]));

    const tx = await mocaPointsV2.connect(admin).setCurrentSeason(newSeason);
    // console.log('current season from the contract: ', await mocaPointsV2.currentSeason());
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('SetCurrentSeason');
    expect(args).to.deep.equal([newSeason]);
  });

  it('upgradeability test: should revert with non-admin role', async function () {
    await expect(upgrades.upgradeProxy(mocaPoints.target, MocaPointsV2.connect(other))).to.be.reverted;
  });

  it('should add ReasonCodes', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await mocaPointsV2.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPointsV2.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);

    expect(await mocaPointsV2.allowedConsumeReasonCodes(reasonCode1)).to.equal(true);
    expect(await mocaPointsV2.allowedConsumeReasonCodes(reasonCode2)).to.equal(true);
  });

  it('Should emit BatchAddConsumeReasonCode event', async function () {
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    const reasonCode2 = ethers.encodeBytes32String('Reason2');
    await mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin);

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

  it('should deposit tokens and update balances correctly with deposit for season and realmId', async function () {
    const reasonCode = ethers.encodeBytes32String('reason');
    const season = ethers.encodeBytes32String('season');
    const parentNode = ethers.encodeBytes32String('moca');
    const name = 'xyz';
    const amount = 100;
    const realmId = await mockRealmContract['getTokenId(string, bytes32)'](name, parentNode);
    const realmIdVersion = Number(await mockRealmContract.burnCounts(realmId));
    const balance = Number(await mocaPointsV2.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId));
    await mocaPointsV2.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);

    await mocaPointsV2.connect(depositor)['deposit(bytes32,uint256,uint256,uint256,bytes32)'](season, realmId, realmIdVersion, amount, reasonCode);
    const updatedBalance = Number(await mocaPointsV2.connect(depositor)['balanceOf(bytes32,uint256)'](season, realmId));
    const finalbalance = balance + 100;

    expect(updatedBalance).to.equal(finalbalance);
  });

  it('Should emit Deposited event with realmId', async function () {
    const reasonCode = ethers.encodeBytes32String('reason');
    const season = ethers.encodeBytes32String('season');
    const parentNode = ethers.encodeBytes32String('moca');
    const name = 'xyz';
    const amount = 100;
    const realmId = await mockRealmContract['getTokenId(string, bytes32)'](name, parentNode);
    const realmIdVersion = Number(await mockRealmContract.burnCounts(realmId));
    await mocaPointsV2.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);

    const tx = await mocaPoints
      .connect(depositor)
      ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](season, realmId, realmIdVersion, amount, reasonCode);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    // console.log('deposit 2 receipt: ', eventName, args);
    expect(eventName).to.equal('Deposited');
    expect(args).to.deep.equal([depositor.address, season, reasonCode, realmId, realmIdVersion, amount]);
  });

  it('should consume tokens with parent node', async function () {
    const parentNode = ethers.encodeBytes32String('node');
    const name = 'xyz';
    const reasonCode1 = ethers.encodeBytes32String('Reason1');
    await mocaPointsV2.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPointsV2.connect(admin).batchAddConsumeReasonCodes([reasonCode1]);
    const currentSeason = mocaPointsV2.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = mockRealmContract.burnCounts(realmId);
    const amount = 10;

    await mocaPointsV2.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);
    await mocaPointsV2
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, reasonCode1);

    const initialBalance = Number(await mocaPointsV2.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));
    await mocaPointsV2.connect(consumer)['consume(bytes32,string,uint256,bytes32)'](parentNode, name, amount, reasonCode1);

    const updatedBalance = Number(await mocaPointsV2.connect(depositor)['balanceOf(bytes32,uint256)'](currentSeason, realmId));
    const finalbalance = initialBalance - amount;

    expect(updatedBalance).to.equal(finalbalance);
  });

  it('should emit Consumed event when consuming tokens with parentNode, name, amount and reasonCode', async function () {
    const name = 'xyz';
    const parentNode = ethers.encodeBytes32String('node');
    const consumeReasonCode = ethers.encodeBytes32String('Reason1');
    await mocaPointsV2.connect(owner).grantRole(ADMIN_ROLE, admin);
    await mocaPointsV2.connect(admin).batchAddConsumeReasonCodes([consumeReasonCode]);
    const currentSeason = await mocaPointsV2.currentSeason();
    const realmId = await mockRealmContract.getTokenId(name, parentNode);
    const realmIdVersion = await mockRealmContract.burnCounts(realmId);
    const amount = 10;
    await mocaPointsV2.connect(owner).grantRole(DEPOSITOR_ROLE, depositor);
    await mocaPointsV2
      .connect(depositor)
      ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](currentSeason, parentNode, name, realmIdVersion, amount, consumeReasonCode);

    const tx = await mocaPoints.connect(consumer)['consume(bytes32,string,uint256,bytes32)'](parentNode, name, amount, consumeReasonCode);
    const receipt = await tx.wait();
    const {eventName, args} = receipt.logs[0];
    expect(eventName).to.equal('Consumed');
    // console.log('=======>', receipt.logs[0]);
    expect(args).to.deep.equal([realmId, currentSeason, consumeReasonCode, consumer.address, realmIdVersion, amount, consumer.address]);
  });
});
