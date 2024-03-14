const {expect} = require('chai');
const {ethers, upgrades} = require('hardhat');
const {loadFixture} = require('@animoca/ethereum-contract-helpers/src/test/fixtures');

describe('RealmPoints Contract', function () {
  let owner, admin, depositor, consumer, signerEOA, other;

  const amount = 100;
  const consumeReasonCode = ethers.encodeBytes32String('consumeReason');
  const parentNode = ethers.encodeBytes32String('moca');
  const nameEOA = 'eoa';
  const name1271 = '1271';

  const fixture = async function () {
    [owner, admin, depositor, consumer, signerEOA, other] = await ethers.getSigners();

    // Deploy the MockERC1271
    this.contractWallet = await ethers.deployContract('MockERC1271', [owner]);

    // Deploy the MockRealmId contract
    const MockRealmIdContract = await ethers.getContractFactory('MockRealmId');
    this.mockRealmId = await MockRealmIdContract.deploy();
    this.mockRealmIdAddress = await this.mockRealmId.getAddress();

    this.realmId = await this.mockRealmId.getTokenId(nameEOA, parentNode);
    this.realmIdVersion = await this.mockRealmId.burnCounts(this.realmId);
    this.realmIdOwner = await this.mockRealmId.ownerOf(this.realmId); //signerEOA

    this.realmId1271 = await this.mockRealmId.getTokenId(name1271, parentNode);
    this.realmId1271Version = await this.mockRealmId.burnCounts(this.realmId1271);
    this.realmId1271Owner = await this.mockRealmId.ownerOf(this.realmId1271); //signer1271

    // Deploy the RealmPoints contract
    this.RealmPointsContract = await ethers.getContractFactory('RealmPoints');
    this.realmPoints = await upgrades.deployProxy(this.RealmPointsContract, [], {
      initializer: 'initialize',
      kind: 'uups',
      constructorArgs: [this.mockRealmIdAddress],
    });

    this.ADMIN_ROLE = ethers.keccak256(Buffer.from('ADMIN_ROLE'));
    this.DEPOSITOR_ROLE = ethers.keccak256(Buffer.from('DEPOSITOR_ROLE'));
    await this.realmPoints.connect(owner).grantRole(this.ADMIN_ROLE, admin.address);
    await this.realmPoints.connect(owner).grantRole(this.DEPOSITOR_ROLE, depositor.address);
  };

  beforeEach(async function () {
    await loadFixture(fixture, this);
  });

  describe('initialize()', function () {
    it('reverts when setting the realmId contract address to zero address', async function () {
      const realmIdContractAddress = ethers.ZeroAddress;
      await expect(
        upgrades.deployProxy(this.RealmPointsContract, [], {initializer: 'initialize', kind: 'uups', constructorArgs: [realmIdContractAddress]})
      )
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'InvalidRealmIdContractAddress')
        .withArgs(ethers.ZeroAddress);
    });

    it('reverts if the contract is already initialized', async function () {
      await expect(this.realmPoints.initialize()).to.be.revertedWith('Initializable: contract is already initialized');
    });

    context('when successful', function () {
      it('initializes the contract with a realmId contract address', async function () {
        await upgrades.deployProxy(this.RealmPointsContract, [], {
          initializer: 'initialize',
          kind: 'uups',
          constructorArgs: [this.mockRealmIdAddress],
        });
      });
    });
  });

  describe('setCurrentSeason(bytes32)', function () {
    it('reverts when setting an existing season', async function () {
      const newSeason = ethers.encodeBytes32String('Season1');
      await this.realmPoints.connect(admin).setCurrentSeason(newSeason);

      await expect(this.realmPoints.connect(admin).setCurrentSeason(newSeason))
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'SeasonAlreadySet')
        .withArgs(newSeason);
    });

    it('reverts when a non admin user set current season', async function () {
      const newSeason = ethers.encodeBytes32String('Season1');
      await expect(this.realmPoints.connect(other).setCurrentSeason(newSeason))
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'NotRoleHolder')
        .withArgs(this.ADMIN_ROLE, other.address);
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.newSeason = ethers.encodeBytes32String('Season1');
        this.receipt = await this.realmPoints.connect(admin).setCurrentSeason(this.newSeason);
      });

      it('sets to new season', async function () {
        expect(await this.realmPoints.currentSeason()).to.equal(this.newSeason);
      });

      it('emits SetCurrentSeason event', async function () {
        await expect(this.receipt).to.emit(this.realmPoints, 'SetCurrentSeason').withArgs(this.newSeason);
      });
    });
  });

  describe('batchAddConsumeReasonCodes(bytes32[])', function () {
    let reasonCode1, reasonCode2;

    before(async function () {
      reasonCode1 = ethers.encodeBytes32String('Reason1');
      reasonCode2 = ethers.encodeBytes32String('Reason2');
    });

    it('reverts when a non admin user trying to add ReasonCodes', async function () {
      await expect(this.realmPoints.connect(other).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]))
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'NotRoleHolder')
        .withArgs(this.ADMIN_ROLE, other.address);
    });

    it('reverts when adding existing ReasonCodes', async function () {
      await this.realmPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);
      await expect(this.realmPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1]))
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'ConsumeReasonCodeAlreadyExists')
        .withArgs(reasonCode1);
    });

    it('reverts when adding an empty array of reason codes', async function () {
      await expect(this.realmPoints.connect(admin).batchAddConsumeReasonCodes([])).to.be.revertedWithCustomError(
        this.RealmPointsContract,
        'ConsumeReasonCodesArrayEmpty'
      );
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.receipt = await this.realmPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);
      });

      it('adds ReasonCodes', async function () {
        expect(await this.realmPoints.allowedConsumeReasonCodes(reasonCode1)).to.equal(true);
        expect(await this.realmPoints.allowedConsumeReasonCodes(reasonCode2)).to.equal(true);
      });

      it('emits BatchAddConsumeReasonCode event', async function () {
        await expect(this.receipt).to.emit(this.realmPoints, 'BatchAddedConsumeReasonCode').withArgs([reasonCode1, reasonCode2]);
      });
    });
  });

  describe('batchRemoveConsumeReasonCodes(bytes32[])', function () {
    let reasonCode1, reasonCode2, reasonCode3;

    before(async function () {
      reasonCode1 = ethers.encodeBytes32String('Reason1');
      reasonCode2 = ethers.encodeBytes32String('Reason2');
      reasonCode3 = ethers.encodeBytes32String('Reason3');
    });

    beforeEach(async function () {
      await this.realmPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);
    });

    it('reverts when a non admin user tries to remove reason codes', async function () {
      await expect(this.realmPoints.connect(other).batchRemoveConsumeReasonCodes([reasonCode1, reasonCode2]))
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'NotRoleHolder')
        .withArgs(this.ADMIN_ROLE, other.address);
    });

    it('reverts when removing reason codes that does not exist', async function () {
      await expect(this.realmPoints.connect(admin).batchRemoveConsumeReasonCodes([reasonCode1, reasonCode3]))
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'ConsumeReasonCodeDoesNotExist')
        .withArgs(reasonCode3);
    });

    it('should revert when removing an empty array of reason codes', async function () {
      await expect(this.realmPoints.connect(admin).batchRemoveConsumeReasonCodes([])).to.be.revertedWithCustomError(
        this.RealmPointsContract,
        'ConsumeReasonCodesArrayEmpty'
      );
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.receipt = await this.realmPoints.connect(admin).batchRemoveConsumeReasonCodes([reasonCode1, reasonCode2]);
      });

      it('removes reason codes', async function () {
        expect(await this.realmPoints.connect(admin).allowedConsumeReasonCodes(reasonCode1)).to.equal(false);
        expect(await this.realmPoints.connect(admin).allowedConsumeReasonCodes(reasonCode2)).to.equal(false);
      });

      it('emits BatchRemovedConsumeReasonCode event', async function () {
        await expect(this.receipt).to.emit(this.realmPoints, 'BatchRemovedConsumeReasonCode').withArgs([reasonCode1, reasonCode2]);
      });
    });
  });

  describe('deposit(bytes32,bytes32,string,uint256,uint256,bytes32)', function () {
    beforeEach(async function () {
      await this.realmPoints.connect(admin).setCurrentSeason(ethers.encodeBytes32String('Season1'));
      this.currentSeason = await this.realmPoints.currentSeason();
      this.depositReasonCode = ethers.encodeBytes32String('depositReason');
    });

    it('reverts if a non depositor role user trying to deposit', async function () {
      await expect(
        this.realmPoints
          .connect(other)
          ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
            this.currentSeason,
            parentNode,
            nameEOA,
            this.realmIdVersion,
            amount,
            this.depositReasonCode
          )
      )
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'NotRoleHolder')
        .withArgs(this.DEPOSITOR_ROLE, other.address);
    });

    it('revert if depositing to a different realmId version', async function () {
      const invalidRealmIdVersion = this.realmIdVersion + 1n;
      await expect(
        this.realmPoints
          .connect(depositor)
          ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
            this.currentSeason,
            parentNode,
            nameEOA,
            invalidRealmIdVersion,
            amount,
            this.depositReasonCode
          )
      )
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'InvalidRealmIdVersion')
        .withArgs(this.realmId, invalidRealmIdVersion);
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.balanceBefore = Number(await this.realmPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, nameEOA));
        this.receipt = await this.realmPoints
          .connect(depositor)
          ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
            this.currentSeason,
            parentNode,
            nameEOA,
            this.realmIdVersion,
            amount,
            this.depositReasonCode
          );
      });

      it('deposits with parendNode and name', async function () {
        const balanceAfter = Number(await this.realmPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, nameEOA));
        expect(balanceAfter - this.balanceBefore).to.equal(amount);
      });

      it('emits Deposited event', async function () {
        await expect(this.receipt)
          .to.emit(this.realmPoints, 'Deposited')
          .withArgs(depositor.address, this.currentSeason, this.depositReasonCode, this.realmId, this.realmIdVersion, amount);
      });
    });
  });

  describe('deposit(bytes32,uint256,uint256,uint256,bytes32)', function () {
    beforeEach(async function () {
      await this.realmPoints.connect(admin).setCurrentSeason(ethers.encodeBytes32String('Season1'));
      this.currentSeason = await this.realmPoints.currentSeason();
      this.depositReasonCode = ethers.encodeBytes32String('depositReason');
    });

    it('reverts if a non a depositor role trying to deposit', async function () {
      await expect(
        this.realmPoints
          .connect(other)
          ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](this.currentSeason, this.realmId, this.realmIdVersion, amount, this.depositReasonCode)
      )
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'NotRoleHolder')
        .withArgs(this.DEPOSITOR_ROLE, other.address);
    });

    it('revert if depositing to a different realmId version', async function () {
      const invalidRealmIdVersion = this.realmIdVersion + 1n;
      await expect(
        this.realmPoints
          .connect(depositor)
          ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](
            this.currentSeason,
            this.realmId,
            invalidRealmIdVersion,
            amount,
            this.depositReasonCode
          )
      )
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'InvalidRealmIdVersion')
        .withArgs(this.realmId, invalidRealmIdVersion);
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.balanceBefore = Number(await this.realmPoints.connect(depositor)['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
        this.receipt = await this.realmPoints
          .connect(depositor)
          ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](this.currentSeason, this.realmId, this.realmIdVersion, amount, this.depositReasonCode);
      });
      it('deposits with season and realmId', async function () {
        this.balanceAfter = Number(await this.realmPoints.connect(depositor)['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
        expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
      });

      it('emits Deposited event', async function () {
        await expect(this.receipt)
          .to.emit(this.realmPoints, 'Deposited')
          .withArgs(depositor.address, this.currentSeason, this.depositReasonCode, this.realmId, this.realmIdVersion, amount);
      });
    });
  });

  describe('consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32) - EOA Wallet', function () {
    beforeEach(async function () {
      await this.realmPoints.connect(admin).batchAddConsumeReasonCodes([consumeReasonCode]);

      this.currentSeason = await this.realmPoints.currentSeason();
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.realmPoints
        .connect(depositor)
        ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
          this.currentSeason,
          parentNode,
          nameEOA,
          this.realmIdVersion,
          amount,
          depositReasonCode
        );
    });

    it('reverts if realmId consumes with a non-exists consume reason code', async function () {
      const nonce = await this.realmPoints.nonces(this.realmId);
      const invalidconsumereasonCode = ethers.encodeBytes32String('invalidReason');
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId, this.realmIdVersion, consumer.address, amount, this.currentSeason, invalidconsumereasonCode, nonce]
      );

      const signature = await signerEOA.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.realmPoints
          .connect(consumer)
          ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, nameEOA, amount, invalidconsumereasonCode, v, r, s)
      )
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'ConsumeReasonCodeDoesNotExist')
        .withArgs(invalidconsumereasonCode);
    });

    it('reverts if signature is not signed from the realmId owner', async function () {
      const nonce = await this.realmPoints.nonces(this.realmId);
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId, this.realmIdVersion, consumer.address, amount, this.currentSeason, consumeReasonCode, nonce]
      );

      const signature = await other.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.realmPoints
          .connect(consumer)
          ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, nameEOA, amount, consumeReasonCode, v, r, s)
      ).to.be.revertedWithCustomError(this.RealmPointsContract, 'InvalidSignature');
    });

    it('reverts if the msg.sender is not the specified spender', async function () {
      const nonce = await this.realmPoints.nonces(this.realmId);
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId, this.realmIdVersion, consumer.address, amount, this.currentSeason, consumeReasonCode, nonce]
      );

      const signature = await signerEOA.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.realmPoints
          .connect(other)
          ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, nameEOA, amount, consumeReasonCode, v, r, s)
      ).to.be.revertedWithCustomError(this.RealmPointsContract, 'InvalidSignature');
    });

    it('reverts if realmId balance is insufficient', async function () {
      const nonce = await this.realmPoints.nonces(this.realmId);
      const insufficientAmount = amount + 100;
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId, this.realmIdVersion, consumer.address, insufficientAmount, this.currentSeason, consumeReasonCode, nonce]
      );

      const signature = await signerEOA.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.realmPoints
          .connect(consumer)
          ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, nameEOA, insufficientAmount, consumeReasonCode, v, r, s)
      )
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'InsufficientBalance')
        .withArgs(this.realmId, insufficientAmount);
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.balanceBefore = Number(await this.realmPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, nameEOA));
        const nonce = await this.realmPoints.nonces(this.realmId);
        const message = ethers.solidityPackedKeccak256(
          ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
          [this.realmId, this.realmIdVersion, consumer.address, amount, this.currentSeason, consumeReasonCode, nonce]
        );

        const signature = await signerEOA.signMessage(ethers.getBytes(message));
        const {v, r, s} = ethers.Signature.from(signature);

        this.receipt = await this.realmPoints
          .connect(consumer)
          ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, nameEOA, amount, consumeReasonCode, v, r, s);
      });

      it('consumes the balance', async function () {
        const balanceAfter = Number(await this.realmPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, nameEOA));
        expect(this.balanceBefore - balanceAfter).to.equal(amount);
      });

      it('emits Consumed event', async function () {
        await expect(this.receipt)
          .to.emit(this.realmPoints, 'Consumed')
          .withArgs(this.realmId, this.currentSeason, consumeReasonCode, consumer.address, this.realmIdVersion, amount, this.realmIdOwner);
      });
    });
  });

  describe('consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32) - Contract Wallet(1271)', function () {
    beforeEach(async function () {
      await this.realmPoints.connect(admin).batchAddConsumeReasonCodes([consumeReasonCode]);

      this.currentSeason = await this.realmPoints.currentSeason();
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.realmPoints
        .connect(depositor)
        ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
          this.currentSeason,
          parentNode,
          name1271,
          this.realmId1271Version,
          amount,
          depositReasonCode
        );
    });

    it('reverts if realmId consumes with a non-exists consume reason code', async function () {
      const nonce = await this.realmPoints.nonces(this.realmId1271);
      const invalidconsumereasonCode = ethers.encodeBytes32String('invalidReason');
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId1271, this.realmId1271Version, consumer.address, amount, this.currentSeason, invalidconsumereasonCode, nonce]
      );

      const signature = await owner.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.realmPoints
          .connect(consumer)
          ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, name1271, amount, invalidconsumereasonCode, v, r, s)
      )
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'ConsumeReasonCodeDoesNotExist')
        .withArgs(invalidconsumereasonCode);
    });

    it('reverts if signature is not signed from the realmId owner', async function () {
      const nonce = await this.realmPoints.nonces(this.realmId1271);
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId1271, this.realmId1271Version, consumer.address, amount, this.currentSeason, consumeReasonCode, nonce]
      );

      const signature = await other.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.realmPoints
          .connect(consumer)
          ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, name1271, amount, consumeReasonCode, v, r, s)
      ).to.be.revertedWithCustomError(this.RealmPointsContract, 'InvalidSignature');
    });

    it('reverts if the msg.sender is not the specified spender', async function () {
      const nonce = await this.realmPoints.nonces(this.realmId1271);
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId1271, this.realmId1271Version, consumer.address, amount, this.currentSeason, consumeReasonCode, nonce]
      );

      const signature = await owner.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.realmPoints
          .connect(other)
          ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, name1271, amount, consumeReasonCode, v, r, s)
      ).to.be.revertedWithCustomError(this.RealmPointsContract, 'InvalidSignature');
    });

    it('reverts if realmId balance is insufficient', async function () {
      const nonce = await this.realmPoints.nonces(this.realmId1271);
      const insufficientAmount = amount + 100;
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId1271, this.realmId1271Version, consumer.address, insufficientAmount, this.currentSeason, consumeReasonCode, nonce]
      );

      const signature = await owner.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.realmPoints
          .connect(consumer)
          ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, name1271, insufficientAmount, consumeReasonCode, v, r, s)
      )
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'InsufficientBalance')
        .withArgs(this.realmId1271, insufficientAmount);
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.balanceBefore = Number(await this.realmPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, name1271));
        const nonce = await this.realmPoints.nonces(this.realmId1271);
        const message = ethers.solidityPackedKeccak256(
          ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
          [this.realmId1271, this.realmId1271Version, consumer.address, amount, this.currentSeason, consumeReasonCode, nonce]
        );

        const signature = await owner.signMessage(ethers.getBytes(message));
        const {v, r, s} = ethers.Signature.from(signature);

        this.receipt = await this.realmPoints
          .connect(consumer)
          ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, name1271, amount, consumeReasonCode, v, r, s);
      });

      it('consumes the balance', async function () {
        const balanceAfter = Number(await this.realmPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, name1271));
        expect(this.balanceBefore - balanceAfter).to.equal(amount);
      });

      it('emits Consumed event', async function () {
        await expect(this.receipt)
          .to.emit(this.realmPoints, 'Consumed')
          .withArgs(
            this.realmId1271,
            this.currentSeason,
            consumeReasonCode,
            consumer.address,
            this.realmId1271Version,
            amount,
            this.realmId1271Owner
          );
      });
    });
  });

  describe('consume(uint256,uint256,bytes32,uint8,bytes32,bytes32) - EOA Wallet', function () {
    beforeEach(async function () {
      await this.realmPoints.connect(admin).batchAddConsumeReasonCodes([consumeReasonCode]);

      this.currentSeason = await this.realmPoints.currentSeason();
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.realmPoints
        .connect(depositor)
        ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](this.currentSeason, this.realmId, this.realmIdVersion, amount, depositReasonCode);
    });

    it('reverts if realmId consumes with a non-exists consume reason code', async function () {
      const nonce = await this.realmPoints.nonces(this.realmId);
      const invalidconsumereasonCode = ethers.encodeBytes32String('Reason2');
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId, this.realmIdVersion, consumer.address, amount, this.currentSeason, invalidconsumereasonCode, nonce]
      );

      const signature = await signerEOA.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.realmPoints
          .connect(consumer)
          ['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](this.realmId, amount, invalidconsumereasonCode, v, r, s)
      )
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'ConsumeReasonCodeDoesNotExist')
        .withArgs(invalidconsumereasonCode);
    });

    it('reverts if signature is not signed from the realmId owner', async function () {
      const nonce = await this.realmPoints.nonces(this.realmId);
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId, this.realmIdVersion, consumer.address, amount, this.currentSeason, consumeReasonCode, nonce]
      );

      const signature = await other.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.realmPoints.connect(consumer)['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](this.realmId, amount, consumeReasonCode, v, r, s)
      ).to.be.revertedWithCustomError(this.RealmPointsContract, 'InvalidSignature');
    });

    it('reverts if msg.sender is not the specified spender', async function () {
      const nonce = await this.realmPoints.nonces(this.realmId);
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId, this.realmIdVersion, consumer.address, amount, this.currentSeason, consumeReasonCode, nonce]
      );

      const signature = await signerEOA.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.realmPoints.connect(other)['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](this.realmId, amount, consumeReasonCode, v, r, s)
      ).to.be.revertedWithCustomError(this.RealmPointsContract, 'InvalidSignature');
    });

    it('reverts if realmId balance is insufficient', async function () {
      const nonce = await this.realmPoints.nonces(this.realmId);
      const insufficientAmount = amount + 100;
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId, this.realmIdVersion, consumer.address, insufficientAmount, this.currentSeason, consumeReasonCode, nonce]
      );

      const signature = await signerEOA.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.realmPoints
          .connect(consumer)
          ['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](this.realmId, insufficientAmount, consumeReasonCode, v, r, s)
      )
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'InsufficientBalance')
        .withArgs(this.realmId, insufficientAmount);
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.balanceBefore = Number(await this.realmPoints['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
        const nonce = await this.realmPoints.nonces(this.realmId);
        const message = ethers.solidityPackedKeccak256(
          ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
          [this.realmId, this.realmIdVersion, consumer.address, amount, this.currentSeason, consumeReasonCode, nonce]
        );

        const signature = await signerEOA.signMessage(ethers.getBytes(message));
        const {v, r, s} = ethers.Signature.from(signature);

        this.receipt = await this.realmPoints
          .connect(consumer)
          ['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](this.realmId, amount, consumeReasonCode, v, r, s);
      });

      it('consumes the balance', async function () {
        const balanceAfter = Number(await this.realmPoints['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
        expect(this.balanceBefore - balanceAfter).to.equal(amount);
      });

      it('emits Consumed event', async function () {
        await expect(this.receipt)
          .to.emit(this.realmPoints, 'Consumed')
          .withArgs(this.realmId, this.currentSeason, consumeReasonCode, consumer.address, this.realmIdVersion, amount, this.realmIdOwner);
      });
    });
  });

  describe('consume(uint256,uint256,bytes32,uint8,bytes32,bytes32) - Contract Wallet(1271)', function () {
    beforeEach(async function () {
      await this.realmPoints.connect(admin).batchAddConsumeReasonCodes([consumeReasonCode]);

      this.currentSeason = await this.realmPoints.currentSeason();
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.realmPoints
        .connect(depositor)
        ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](
          this.currentSeason,
          this.realmId1271,
          this.realmId1271Version,
          amount,
          depositReasonCode
        );
    });

    it('reverts if realmId consumes with a non-exists consume reason code', async function () {
      const nonce = await this.realmPoints.nonces(this.realmId1271Version);
      const invalidconsumereasonCode = ethers.encodeBytes32String('Reason2');
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId1271, this.realmId1271Version, consumer.address, amount, this.currentSeason, invalidconsumereasonCode, nonce]
      );

      const signature = await owner.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.realmPoints
          .connect(consumer)
          ['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](this.realmId1271, amount, invalidconsumereasonCode, v, r, s)
      )
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'ConsumeReasonCodeDoesNotExist')
        .withArgs(invalidconsumereasonCode);
    });

    it('reverts if signature is not signed from the realmId owner', async function () {
      const nonce = await this.realmPoints.nonces(this.realmId1271);
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId1271, this.realmId1271Version, consumer.address, amount, this.currentSeason, consumeReasonCode, nonce]
      );

      const signature = await other.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.realmPoints
          .connect(consumer)
          ['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](this.realmId1271, amount, consumeReasonCode, v, r, s)
      ).to.be.revertedWithCustomError(this.RealmPointsContract, 'InvalidSignature');
    });

    it('reverts if msg.sender is not the specified spender', async function () {
      const nonce = await this.realmPoints.nonces(this.realmId1271);
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId1271, this.realmId1271Version, consumer.address, amount, this.currentSeason, consumeReasonCode, nonce]
      );

      const signature = await owner.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.realmPoints
          .connect(other)
          ['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](this.realmId1271, amount, consumeReasonCode, v, r, s)
      ).to.be.revertedWithCustomError(this.RealmPointsContract, 'InvalidSignature');
    });

    it('reverts if realmId balance is insufficient', async function () {
      const nonce = await this.realmPoints.nonces(this.realmId1271);
      const insufficientAmount = amount + 100;
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId1271, this.realmId1271Version, consumer.address, insufficientAmount, this.currentSeason, consumeReasonCode, nonce]
      );

      const signature = await owner.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.realmPoints
          .connect(consumer)
          ['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](this.realmId1271, insufficientAmount, consumeReasonCode, v, r, s)
      )
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'InsufficientBalance')
        .withArgs(this.realmId1271, insufficientAmount);
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.balanceBefore = Number(await this.realmPoints['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId1271));
        const nonce = await this.realmPoints.nonces(this.realmId1271);
        const message = ethers.solidityPackedKeccak256(
          ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
          [this.realmId1271, this.realmId1271Version, consumer.address, amount, this.currentSeason, consumeReasonCode, nonce]
        );

        const signature = await owner.signMessage(ethers.getBytes(message));
        const {v, r, s} = ethers.Signature.from(signature);

        this.receipt = await this.realmPoints
          .connect(consumer)
          ['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](this.realmId1271, amount, consumeReasonCode, v, r, s);
      });

      it('consumes the balance', async function () {
        const balanceAfter = Number(await this.realmPoints['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId1271));
        expect(this.balanceBefore - balanceAfter).to.equal(amount);
      });

      it('emits Consumed event', async function () {
        await expect(this.receipt)
          .to.emit(this.realmPoints, 'Consumed')
          .withArgs(this.realmId1271, this.currentSeason, consumeReasonCode, consumer.address, this.realmIdVersion, amount, this.realmId1271Owner);
      });
    });
  });

  describe('consume(bytes32,string,uint256,bytes32)', function () {
    beforeEach(async function () {
      await this.realmPoints.connect(admin).batchAddConsumeReasonCodes([consumeReasonCode]);

      this.currentSeason = await this.realmPoints.currentSeason();
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.realmPoints
        .connect(depositor)
        ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
          this.currentSeason,
          parentNode,
          nameEOA,
          this.realmIdVersion,
          amount,
          depositReasonCode
        );
    });

    it('reverts if realmId consumes with a non-exists consume reason code', async function () {
      const invalidconsumereasonCode = ethers.encodeBytes32String('Reason2');
      await expect(
        this.realmPoints.connect(signerEOA)['consume(bytes32,string,uint256,bytes32)'](parentNode, nameEOA, amount, invalidconsumereasonCode)
      )
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'ConsumeReasonCodeDoesNotExist')
        .withArgs(invalidconsumereasonCode);
    });

    it('reverts if msgSender is not the realmId owner', async function () {
      await expect(this.realmPoints.connect(other)['consume(bytes32,string,uint256,bytes32)'](parentNode, nameEOA, amount, consumeReasonCode))
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'IncorrectSigner')
        .withArgs(other.address);
    });

    it('reverts if realmId balance is insufficient', async function () {
      const insufficientAmount = amount + 100;
      await expect(
        this.realmPoints.connect(signerEOA)['consume(bytes32,string,uint256,bytes32)'](parentNode, nameEOA, insufficientAmount, consumeReasonCode)
      )
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'InsufficientBalance')
        .withArgs(this.realmId, insufficientAmount);
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.balanceBefore = Number(await this.realmPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, nameEOA));
        this.receipt = await this.realmPoints
          .connect(signerEOA)
          ['consume(bytes32,string,uint256,bytes32)'](parentNode, nameEOA, amount, consumeReasonCode);
      });

      it('consumes the balance', async function () {
        const balanceAfter = Number(await this.realmPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, nameEOA));
        expect(this.balanceBefore - balanceAfter).to.equal(amount);
      });

      it('emits Consumed event', async function () {
        await expect(this.receipt)
          .to.emit(this.realmPoints, 'Consumed')
          .withArgs(this.realmId, this.currentSeason, consumeReasonCode, signerEOA.address, this.realmIdVersion, amount, signerEOA.address);
      });
    });
  });

  describe('consume(uint256,uint256,bytes32)', function () {
    beforeEach(async function () {
      await this.realmPoints.connect(admin).batchAddConsumeReasonCodes([consumeReasonCode]);

      this.currentSeason = await this.realmPoints.currentSeason();
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.realmPoints
        .connect(depositor)
        ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](this.currentSeason, this.realmId, this.realmIdVersion, amount, depositReasonCode);
    });

    it('reverts if realmId consumes with a non-exists consume reason code', async function () {
      const invalidconsumereasonCode = ethers.encodeBytes32String('Reason2');
      await expect(this.realmPoints.connect(signerEOA)['consume(uint256,uint256,bytes32)'](this.realmId, amount, invalidconsumereasonCode))
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'ConsumeReasonCodeDoesNotExist')
        .withArgs(invalidconsumereasonCode);
    });

    it('reverts if msgSender is not the realmId owner', async function () {
      await expect(this.realmPoints.connect(other)['consume(uint256,uint256,bytes32)'](this.realmId, amount, consumeReasonCode))
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'IncorrectSigner')
        .withArgs(other.address);
    });

    it('reverts if realmId balance is insufficient', async function () {
      const insufficientAmount = amount + 100;
      await expect(this.realmPoints.connect(signerEOA)['consume(uint256,uint256,bytes32)'](this.realmId, insufficientAmount, consumeReasonCode))
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'InsufficientBalance')
        .withArgs(this.realmId, insufficientAmount);
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.balanceBefore = Number(await this.realmPoints['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
        this.receipt = await this.realmPoints.connect(signerEOA)['consume(uint256,uint256,bytes32)'](this.realmId, amount, consumeReasonCode);
      });

      it('consumes the balance', async function () {
        const balanceAfter = Number(await this.realmPoints['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
        expect(this.balanceBefore - balanceAfter).to.equal(amount);
      });

      it('emits Consumed event', async function () {
        await expect(this.receipt)
          .to.emit(this.realmPoints, 'Consumed')
          .withArgs(this.realmId, this.currentSeason, consumeReasonCode, signerEOA.address, this.realmIdVersion, amount, signerEOA.address);
      });
    });
  });

  describe('balanceOf(bytes32,uint256)', function () {
    beforeEach(async function () {
      this.currentSeason = await this.realmPoints.currentSeason();
      this.balanceBefore = Number(await this.realmPoints['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
    });

    it('returns 0 if the realmId does not exist', async function () {
      expect(this.balanceBefore).to.equal(0);
    });

    it('returns the balance when deposit(bytes32,bytes32,string,uint256,uint256,bytes32) is called', async function () {
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.realmPoints
        .connect(depositor)
        ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
          this.currentSeason,
          parentNode,
          nameEOA,
          this.realmIdVersion,
          amount,
          depositReasonCode
        );

      this.balanceAfter = Number(await this.realmPoints['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
      expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
    });

    it('returns the balance when deposit(bytes32,uint256,uint256,uint256,bytes32) is called', async function () {
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.realmPoints
        .connect(depositor)
        ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](this.currentSeason, this.realmId, this.realmIdVersion, amount, depositReasonCode);

      this.balanceAfter = Number(await this.realmPoints['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
      expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
    });
  });

  describe('balanceOf(bytes32,bytes32,string)', function () {
    beforeEach(async function () {
      this.currentSeason = await this.realmPoints.currentSeason();
      this.balanceBefore = Number(await this.realmPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, nameEOA));
    });

    it('returns 0 if the realmId does not exist', async function () {
      expect(this.balanceBefore).to.equal(0);
    });

    it('returns the balance when deposit(bytes32,bytes32,string,uint256,uint256,bytes32) is called', async function () {
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.realmPoints
        .connect(depositor)
        ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
          this.currentSeason,
          parentNode,
          nameEOA,
          this.realmIdVersion,
          amount,
          depositReasonCode
        );

      this.balanceAfter = Number(await this.realmPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, nameEOA));
      expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
    });

    it('returns the balance when deposit(bytes32,uint256,uint256,uint256,bytes32) is called', async function () {
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.realmPoints
        .connect(depositor)
        ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](this.currentSeason, this.realmId, this.realmIdVersion, amount, depositReasonCode);

      this.balanceAfter = Number(await this.realmPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, nameEOA));
      expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
    });
  });

  describe('balanceOf(uint256)', function () {
    beforeEach(async function () {
      this.currentSeason = await this.realmPoints.currentSeason();
      this.balanceBefore = Number(await this.realmPoints['balanceOf(uint256)'](this.realmId));
    });

    it('returns 0 if the realmId does not exist', async function () {
      expect(this.balanceBefore).to.equal(0);
    });

    it('returns the balance when deposit(bytes32,bytes32,string,uint256,uint256,bytes32) is called', async function () {
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.realmPoints
        .connect(depositor)
        ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
          this.currentSeason,
          parentNode,
          nameEOA,
          this.realmIdVersion,
          amount,
          depositReasonCode
        );

      this.balanceAfter = Number(await this.realmPoints['balanceOf(uint256)'](this.realmId));
      expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
    });

    it('returns the balance when deposit(bytes32,uint256,uint256,uint256,bytes32) is called', async function () {
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.realmPoints
        .connect(depositor)
        ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](this.currentSeason, this.realmId, this.realmIdVersion, amount, depositReasonCode);

      this.balanceAfter = Number(await this.realmPoints['balanceOf(uint256)'](this.realmId));
      expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
    });
  });

  describe('balanceOf(bytes32,string)', function () {
    beforeEach(async function () {
      this.currentSeason = await this.realmPoints.currentSeason();
      this.balanceBefore = Number(await this.realmPoints['balanceOf(bytes32,string)'](parentNode, nameEOA));
    });

    it('returns 0 if the realmId does not exist', async function () {
      expect(this.balanceBefore).to.equal(0);
    });

    it('returns the balance when deposit(bytes32,bytes32,string,uint256,uint256,bytes32) is called', async function () {
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.realmPoints
        .connect(depositor)
        ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
          this.currentSeason,
          parentNode,
          nameEOA,
          this.realmIdVersion,
          amount,
          depositReasonCode
        );

      this.balanceAfter = Number(await this.realmPoints['balanceOf(bytes32,string)'](parentNode, nameEOA));
      expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
    });

    it('returns the balance when deposit(bytes32,uint256,uint256,uint256,bytes32) is called', async function () {
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.realmPoints
        .connect(depositor)
        ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](this.currentSeason, this.realmId, this.realmIdVersion, amount, depositReasonCode);

      this.balanceAfter = Number(await this.realmPoints['balanceOf(bytes32,string)'](parentNode, nameEOA));
      expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
    });
  });

  describe('preparePayload(uint256,uint256,bytes32)', function () {
    it('returns encoded Payload', async function () {
      const nonce = await this.realmPoints.nonces(this.realmId);
      const currentSeason = await this.realmPoints.currentSeason();

      const payload = await this.realmPoints.preparePayload(this.realmId, this.realmIdOwner, amount, consumeReasonCode);
      const expectedPayload = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId, this.realmIdVersion, this.realmIdOwner, amount, currentSeason, consumeReasonCode, nonce]
      );
      expect(payload).to.equal(expectedPayload);
    });
  });

  describe('Contract Upgrade', function () {
    beforeEach(async function () {
      this.MockRealmPointsUpgrade = await ethers.getContractFactory('MockRealmPointsUpgrade');
    });

    it('reverts if a non owner authorizes an upgrade', async function () {
      await expect(
        upgrades.upgradeProxy(this.realmPoints.target, this.MockRealmPointsUpgrade.connect(other), {
          constructorArgs: [this.mockRealmIdAddress],
        })
      )
        .to.be.revertedWithCustomError(this.RealmPointsContract, 'NotContractOwner')
        .withArgs(other.address);
    });

    it('reverts if the contract initialized twice', async function () {
      const realmPointsV2 = await upgrades.upgradeProxy(this.realmPoints.target, this.MockRealmPointsUpgrade.connect(owner), {
        constructorArgs: [this.mockRealmIdAddress],
      });
      await realmPointsV2.initializeV2(100);
      expect(realmPointsV2.initializeV2(100)).to.be.revertedWith('Initializable: contract is already initialized');
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.realmPointsV2 = await upgrades.upgradeProxy(this.realmPoints.target, this.MockRealmPointsUpgrade.connect(owner), {
          call: {
            fn: 'initializeV2',
            args: [100],
          },
          constructorArgs: [this.mockRealmIdAddress],
        });
      });

      it('value assigned to the new variable', async function () {
        expect(await this.realmPointsV2.val()).to.be.equal(100);
      });
    });
  });
});
