const {expect} = require('chai');
const {ethers, upgrades} = require('hardhat');
const {loadFixture} = require('@animoca/ethereum-contract-helpers/src/test/fixtures');

describe('MocaPoints Contract', function () {
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

    this.realmId = await this.mockRealmId.getTokenId(name, parentNode);
    this.realmIdVersion = Number(await this.mockRealmId.burnCounts(this.realmId));

    // Deploy the MocaPoints contract
    const MocaPoints = await ethers.getContractFactory('MocaPoints');
    this.mocaPoints = await upgrades.deployProxy(MocaPoints, [this.mockRealmIdAddress], {
      initializer: 'initialize',
      kind: 'uups',
    });

    const ADMIN_ROLE = ethers.keccak256(Buffer.from('ADMIN_ROLE'));
    const DEPOSITOR_ROLE = ethers.keccak256(Buffer.from('DEPOSITOR_ROLE'));
    await this.mocaPoints.connect(owner).grantRole(ADMIN_ROLE, admin.address);
    await this.mocaPoints.connect(owner).grantRole(DEPOSITOR_ROLE, depositor.address);
  };

  beforeEach(async function () {
    await loadFixture(fixture, this);
  });

  describe('initialize(address)', function () {
    before(async function () {
      this.MocaPointsContract = await ethers.getContractFactory('MocaPoints');
    });

    it('reverts when setting the realmId contract address to zero address', async function () {
      const realmIdContractAddress = ethers.ZeroAddress;
      await expect(
        upgrades.deployProxy(this.MocaPointsContract, [realmIdContractAddress], {initializer: 'initialize', kind: 'uups'})
      ).to.be.revertedWith('Not a valid Contract Address');
    });

    it('reverts if the contract is already initialized', async function () {
      await expect(this.mocaPoints.initialize(this.mockRealmIdAddress)).to.be.revertedWith('Initializable: contract is already initialized');
    });

    context('when successful', function () {
      it('initializes the contract with a realmId contract address', async function () {
        await upgrades.deployProxy(this.MocaPointsContract, [this.mockRealmIdAddress], {initializer: 'initialize', kind: 'uups'});
      });
    });
  });

  describe('setCurrentSeason(bytes32)', function () {
    it('reverts when setting an existing season', async function () {
      const newSeason = ethers.encodeBytes32String('Season1');
      await this.mocaPoints.connect(admin).setCurrentSeason(newSeason);

      await expect(this.mocaPoints.connect(admin).setCurrentSeason(newSeason)).to.be.revertedWith('Season already set');
    });

    it('reverts when a non admin user set current season', async function () {
      const newSeason = ethers.encodeBytes32String('Season1');
      await expect(this.mocaPoints.connect(other).setCurrentSeason(newSeason)).to.be.reverted;
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.newSeason = ethers.encodeBytes32String('Season1');
        this.receipt = await this.mocaPoints.connect(admin).setCurrentSeason(this.newSeason);
      });

      it('sets to new season', async function () {
        expect(await this.mocaPoints.currentSeason()).to.equal(this.newSeason);
      });

      it('emits SetCurrentSeason event', async function () {
        await expect(this.receipt).to.emit(this.mocaPoints, 'SetCurrentSeason').withArgs(this.newSeason);
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
      await expect(this.mocaPoints.connect(other).batchAddConsumeReasonCodes([reasonCode1, reasonCode2])).to.be.reverted;
    });

    it('reverts when adding existing ReasonCodes', async function () {
      await this.mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);
      await expect(this.mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1])).to.be.revertedWith('Reason code already exists');
    });

    it('reverts when adding an empty array of reason codes', async function () {
      await expect(this.mocaPoints.connect(admin).batchAddConsumeReasonCodes([])).to.be.revertedWith('Empty Reason codes array');
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.receipt = await this.mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);
      });

      it('adds ReasonCodes', async function () {
        expect(await this.mocaPoints.allowedConsumeReasonCodes(reasonCode1)).to.equal(true);
        expect(await this.mocaPoints.allowedConsumeReasonCodes(reasonCode2)).to.equal(true);
      });

      it('emits BatchAddConsumeReasonCode event', async function () {
        await expect(this.receipt).to.emit(this.mocaPoints, 'BatchAddedConsumeReasonCode').withArgs([reasonCode1, reasonCode2]);
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
      await this.mocaPoints.connect(admin).batchAddConsumeReasonCodes([reasonCode1, reasonCode2]);
    });

    it('reverts when a non admin user tries to remove reason codes', async function () {
      await expect(this.mocaPoints.connect(other).batchRemoveConsumeReasonCodes([reasonCode1, reasonCode2])).to.be.reverted;
    });

    it('reverts when removing reason codes that does not exist', async function () {
      await expect(this.mocaPoints.connect(admin).batchRemoveConsumeReasonCodes([reasonCode1, reasonCode3])).to.be.revertedWith(
        'Reason code does not exist'
      );
    });

    it('should revert when removing an empty array of reason codes', async function () {
      await expect(this.mocaPoints.connect(admin).batchRemoveConsumeReasonCodes([])).to.be.revertedWith('Empty Reason codes array');
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.receipt = await this.mocaPoints.connect(admin).batchRemoveConsumeReasonCodes([reasonCode1, reasonCode2]);
      });

      it('removes reason codes', async function () {
        expect(await this.mocaPoints.connect(admin).allowedConsumeReasonCodes(reasonCode1)).to.equal(false);
        expect(await this.mocaPoints.connect(admin).allowedConsumeReasonCodes(reasonCode2)).to.equal(false);
      });

      it('emits BatchRemovedConsumeReasonCode event', async function () {
        await expect(this.receipt).to.emit(this.mocaPoints, 'BatchRemovedConsumeReasonCode').withArgs([reasonCode1, reasonCode2]);
      });
    });
  });

  describe('deposit(bytes32,bytes32,string,uint256,uint256,bytes32)', function () {
    beforeEach(async function () {
      await this.mocaPoints.connect(admin).setCurrentSeason(ethers.encodeBytes32String('Season1'));
      this.currentSeason = await this.mocaPoints.currentSeason();
      this.depositReasonCode = ethers.encodeBytes32String('depositReason');
    });

    it('reverts if a non depositor role user trying to deposit', async function () {
      await expect(
        this.mocaPoints
          .connect(other)
          ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
            this.currentSeason,
            parentNode,
            name,
            this.realmIdVersion,
            amount,
            this.depositReasonCode
          )
      ).to.be.reverted;
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.balanceBefore = Number(await this.mocaPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, name));
        this.receipt = await this.mocaPoints
          .connect(depositor)
          ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
            this.currentSeason,
            parentNode,
            name,
            this.realmIdVersion,
            amount,
            this.depositReasonCode
          );
      });

      it('deposits with parendNode and name', async function () {
        const balanceAfter = Number(await this.mocaPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, name));
        expect(balanceAfter - this.balanceBefore).to.equal(amount);
      });

      it('emits Deposited event', async function () {
        await expect(this.receipt)
          .to.emit(this.mocaPoints, 'Deposited')
          .withArgs(depositor.address, this.currentSeason, this.depositReasonCode, this.realmId, this.realmIdVersion, amount);
      });
    });
  });

  describe('deposit(bytes32,uint256,uint256,uint256,bytes32)', function () {
    beforeEach(async function () {
      await this.mocaPoints.connect(admin).setCurrentSeason(ethers.encodeBytes32String('Season1'));
      this.currentSeason = await this.mocaPoints.currentSeason();
      this.depositReasonCode = ethers.encodeBytes32String('depositReason');
    });

    it('reverts if a non a depositor role trying to deposit', async function () {
      await expect(
        this.mocaPoints
          .connect(other)
          ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](this.currentSeason, this.realmId, this.realmIdVersion, amount, this.depositReasonCode)
      ).to.be.reverted;
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.balanceBefore = Number(await this.mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
        this.receipt = await this.mocaPoints
          .connect(depositor)
          ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](this.currentSeason, this.realmId, this.realmIdVersion, amount, this.depositReasonCode);
      });
      it('deposits with season and realmId', async function () {
        this.balanceAfter = Number(await this.mocaPoints.connect(depositor)['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
        expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
      });

      it('emits Deposited event', async function () {
        await expect(this.receipt)
          .to.emit(this.mocaPoints, 'Deposited')
          .withArgs(depositor.address, this.currentSeason, this.depositReasonCode, this.realmId, this.realmIdVersion, amount);
      });
    });
  });

  describe('consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)', function () {
    beforeEach(async function () {
      await this.mocaPoints.connect(admin).batchAddConsumeReasonCodes([consumeReasonCode]);

      this.currentSeason = await this.mocaPoints.currentSeason();
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.mocaPoints
        .connect(depositor)
        ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
          this.currentSeason,
          parentNode,
          name,
          this.realmIdVersion,
          amount,
          depositReasonCode
        );
    });

    it('reverts if realmId consumes with a non-exists consume reason code', async function () {
      const nonce = await this.mocaPoints.nonces(this.realmId);
      const invalidconsumereasonCode = ethers.encodeBytes32String('invalidReason');
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId, this.realmIdVersion, amount, this.currentSeason, invalidconsumereasonCode, nonce]
      );

      const signature = await consumer.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.mocaPoints
          .connect(consumer)
          ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, name, amount, invalidconsumereasonCode, v, r, s)
      ).to.be.revertedWith('Invalid consume reason code');
    });

    it('reverts if signature is not signed from the realmId owner', async function () {
      const nonce = await this.mocaPoints.nonces(this.realmId);
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId, this.realmIdVersion, amount, this.currentSeason, consumeReasonCode, nonce]
      );

      const signature = await other.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.mocaPoints
          .connect(consumer)
          ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, name, amount, consumeReasonCode, v, r, s)
      ).to.be.revertedWith('Signer is not the owner');
    });

    it('reverts if realmId balance is insufficient', async function () {
      const nonce = await this.mocaPoints.nonces(this.realmId);
      const insufficientAmount = amount + 100;
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId, this.realmIdVersion, insufficientAmount, this.currentSeason, consumeReasonCode, nonce]
      );

      const signature = await consumer.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.mocaPoints
          .connect(consumer)
          ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, name, insufficientAmount, consumeReasonCode, v, r, s)
      ).to.be.revertedWith('Insufficient balance');
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.balanceBefore = Number(await this.mocaPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, name));
        const nonce = await this.mocaPoints.nonces(this.realmId);
        const message = ethers.solidityPackedKeccak256(
          ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
          [this.realmId, this.realmIdVersion, amount, this.currentSeason, consumeReasonCode, nonce]
        );

        const signature = await consumer.signMessage(ethers.getBytes(message));
        const {v, r, s} = ethers.Signature.from(signature);

        this.receipt = await this.mocaPoints
          .connect(consumer)
          ['consume(bytes32,string,uint256,bytes32,uint8,bytes32,bytes32)'](parentNode, name, amount, consumeReasonCode, v, r, s);
      });

      it('consumes the balance', async function () {
        const balanceAfter = Number(await this.mocaPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, name));
        expect(this.balanceBefore - balanceAfter).to.equal(amount);
      });

      it('emits Consumed event', async function () {
        await expect(this.receipt)
          .to.emit(this.mocaPoints, 'Consumed')
          .withArgs(this.realmId, this.currentSeason, consumeReasonCode, consumer.address, this.realmIdVersion, amount, consumer.address);
      });
    });
  });

  describe('consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)', function () {
    beforeEach(async function () {
      await this.mocaPoints.connect(admin).batchAddConsumeReasonCodes([consumeReasonCode]);

      this.currentSeason = await this.mocaPoints.currentSeason();
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.mocaPoints
        .connect(depositor)
        ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](this.currentSeason, this.realmId, this.realmIdVersion, amount, depositReasonCode);
    });

    it('reverts if realmId consumes with a non-exists consume reason code', async function () {
      const nonce = await this.mocaPoints.nonces(this.realmId);
      const invalidconsumereasonCode = ethers.encodeBytes32String('Reason2');
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId, this.realmIdVersion, amount, this.currentSeason, invalidconsumereasonCode, nonce]
      );

      const signature = await consumer.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.mocaPoints
          .connect(consumer)
          ['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](this.realmId, amount, invalidconsumereasonCode, v, r, s)
      ).to.be.revertedWith('Invalid consume reason code');
    });

    it('reverts if signature is not signed from the realmId owner', async function () {
      const nonce = await this.mocaPoints.nonces(this.realmId);
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId, this.realmIdVersion, amount, this.currentSeason, consumeReasonCode, nonce]
      );

      const signature = await other.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.mocaPoints.connect(consumer)['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](this.realmId, amount, consumeReasonCode, v, r, s)
      ).to.be.revertedWith('Signer is not the owner');
    });

    it('reverts if realmId balance is insufficient', async function () {
      const nonce = await this.mocaPoints.nonces(this.realmId);
      const insufficientAmount = amount + 100;
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId, this.realmIdVersion, insufficientAmount, this.currentSeason, consumeReasonCode, nonce]
      );

      const signature = await consumer.signMessage(ethers.getBytes(message));
      const {v, r, s} = ethers.Signature.from(signature);

      await expect(
        this.mocaPoints
          .connect(consumer)
          ['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](this.realmId, insufficientAmount, consumeReasonCode, v, r, s)
      ).to.be.revertedWith('Insufficient balance');
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.balanceBefore = Number(await this.mocaPoints['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
        const nonce = await this.mocaPoints.nonces(this.realmId);
        const message = ethers.solidityPackedKeccak256(
          ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
          [this.realmId, this.realmIdVersion, amount, this.currentSeason, consumeReasonCode, nonce]
        );

        const signature = await consumer.signMessage(ethers.getBytes(message));
        const {v, r, s} = ethers.Signature.from(signature);

        this.receipt = await this.mocaPoints
          .connect(consumer)
          ['consume(uint256,uint256,bytes32,uint8,bytes32,bytes32)'](this.realmId, amount, consumeReasonCode, v, r, s);
      });

      it('consumes the balance', async function () {
        const balanceAfter = Number(await this.mocaPoints['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
        expect(this.balanceBefore - balanceAfter).to.equal(amount);
      });

      it('emits Consumed event', async function () {
        await expect(this.receipt)
          .to.emit(this.mocaPoints, 'Consumed')
          .withArgs(this.realmId, this.currentSeason, consumeReasonCode, consumer.address, this.realmIdVersion, amount, consumer.address);
      });
    });
  });

  describe('consume(bytes32,string,uint256,bytes32)', function () {
    beforeEach(async function () {
      await this.mocaPoints.connect(admin).batchAddConsumeReasonCodes([consumeReasonCode]);

      this.currentSeason = await this.mocaPoints.currentSeason();
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.mocaPoints
        .connect(depositor)
        ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
          this.currentSeason,
          parentNode,
          name,
          this.realmIdVersion,
          amount,
          depositReasonCode
        );
    });

    it('reverts if realmId consumes with a non-exists consume reason code', async function () {
      const invalidconsumereasonCode = ethers.encodeBytes32String('Reason2');
      await expect(
        this.mocaPoints.connect(consumer)['consume(bytes32,string,uint256,bytes32)'](parentNode, name, amount, invalidconsumereasonCode)
      ).to.be.revertedWith('Invalid consume reason code');
    });

    it('reverts if msgSender is not the realmId owner', async function () {
      await expect(
        this.mocaPoints.connect(other)['consume(bytes32,string,uint256,bytes32)'](parentNode, name, amount, consumeReasonCode)
      ).to.be.revertedWith('Sender is not the owner');
    });

    it('reverts if realmId balance is insufficient', async function () {
      const insufficientAmount = amount + 100;
      await expect(
        this.mocaPoints.connect(consumer)['consume(bytes32,string,uint256,bytes32)'](parentNode, name, insufficientAmount, consumeReasonCode)
      ).to.be.revertedWith('Insufficient balance');
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.balanceBefore = Number(await this.mocaPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, name));
        this.receipt = await this.mocaPoints
          .connect(consumer)
          ['consume(bytes32,string,uint256,bytes32)'](parentNode, name, amount, consumeReasonCode);
      });

      it('consumes the balance', async function () {
        const balanceAfter = Number(await this.mocaPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, name));
        expect(this.balanceBefore - balanceAfter).to.equal(amount);
      });

      it('emits Consumed event', async function () {
        await expect(this.receipt)
          .to.emit(this.mocaPoints, 'Consumed')
          .withArgs(this.realmId, this.currentSeason, consumeReasonCode, consumer.address, this.realmIdVersion, amount, consumer.address);
      });
    });
  });

  describe('consume(uint256,uint256,bytes32)', function () {
    beforeEach(async function () {
      await this.mocaPoints.connect(admin).batchAddConsumeReasonCodes([consumeReasonCode]);

      this.currentSeason = await this.mocaPoints.currentSeason();
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.mocaPoints
        .connect(depositor)
        ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](this.currentSeason, this.realmId, this.realmIdVersion, amount, depositReasonCode);
    });

    it('reverts if realmId consumes with a non-exists consume reason code', async function () {
      const invalidconsumereasonCode = ethers.encodeBytes32String('Reason2');
      await expect(
        this.mocaPoints.connect(consumer)['consume(uint256,uint256,bytes32)'](this.realmId, amount, invalidconsumereasonCode)
      ).to.be.revertedWith('Invalid consume reason code');
    });

    it('reverts if msgSender is not the realmId owner', async function () {
      await expect(this.mocaPoints.connect(other)['consume(uint256,uint256,bytes32)'](this.realmId, amount, consumeReasonCode)).to.be.revertedWith(
        'Sender is not the owner'
      );
    });

    it('reverts if realmId balance is insufficient', async function () {
      const insufficientAmount = amount + 100;
      await expect(
        this.mocaPoints.connect(consumer)['consume(uint256,uint256,bytes32)'](this.realmId, insufficientAmount, consumeReasonCode)
      ).to.be.revertedWith('Insufficient balance');
    });

    context('when successful', function () {
      beforeEach(async function () {
        this.balanceBefore = Number(await this.mocaPoints['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
        this.receipt = await this.mocaPoints.connect(consumer)['consume(uint256,uint256,bytes32)'](this.realmId, amount, consumeReasonCode);
      });

      it('consumes the balance', async function () {
        const balanceAfter = Number(await this.mocaPoints['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
        expect(this.balanceBefore - balanceAfter).to.equal(amount);
      });

      it('emits Consumed event', async function () {
        await expect(this.receipt)
          .to.emit(this.mocaPoints, 'Consumed')
          .withArgs(this.realmId, this.currentSeason, consumeReasonCode, consumer.address, this.realmIdVersion, amount, consumer.address);
      });
    });
  });

  describe('balanceOf(bytes32,uint256)', function () {
    beforeEach(async function () {
      this.currentSeason = await this.mocaPoints.currentSeason();
      this.balanceBefore = Number(await this.mocaPoints['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
    });

    it('returns 0 if the realmId does not exist', async function () {
      expect(this.balanceBefore).to.equal(0);
    });

    it('returns the balance when deposit(bytes32,bytes32,string,uint256,uint256,bytes32) is called', async function () {
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.mocaPoints
        .connect(depositor)
        ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
          this.currentSeason,
          parentNode,
          name,
          this.realmIdVersion,
          amount,
          depositReasonCode
        );

      this.balanceAfter = Number(await this.mocaPoints['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
      expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
    });

    it('returns the balance when deposit(bytes32,uint256,uint256,uint256,bytes32) is called', async function () {
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.mocaPoints
        .connect(depositor)
        ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](this.currentSeason, this.realmId, this.realmIdVersion, amount, depositReasonCode);

      this.balanceAfter = Number(await this.mocaPoints['balanceOf(bytes32,uint256)'](this.currentSeason, this.realmId));
      expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
    });
  });

  describe('balanceOf(bytes32,bytes32,string)', function () {
    beforeEach(async function () {
      this.currentSeason = await this.mocaPoints.currentSeason();
      this.balanceBefore = Number(await this.mocaPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, name));
    });

    it('returns 0 if the realmId does not exist', async function () {
      expect(this.balanceBefore).to.equal(0);
    });

    it('returns the balance when deposit(bytes32,bytes32,string,uint256,uint256,bytes32) is called', async function () {
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.mocaPoints
        .connect(depositor)
        ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
          this.currentSeason,
          parentNode,
          name,
          this.realmIdVersion,
          amount,
          depositReasonCode
        );

      this.balanceAfter = Number(await this.mocaPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, name));
      expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
    });

    it('returns the balance when deposit(bytes32,uint256,uint256,uint256,bytes32) is called', async function () {
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.mocaPoints
        .connect(depositor)
        ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](this.currentSeason, this.realmId, this.realmIdVersion, amount, depositReasonCode);

      this.balanceAfter = Number(await this.mocaPoints['balanceOf(bytes32,bytes32,string)'](this.currentSeason, parentNode, name));
      expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
    });
  });

  describe('balanceOf(uint256)', function () {
    beforeEach(async function () {
      this.currentSeason = await this.mocaPoints.currentSeason();
      this.balanceBefore = Number(await this.mocaPoints['balanceOf(uint256)'](this.realmId));
    });

    it('returns 0 if the realmId does not exist', async function () {
      expect(this.balanceBefore).to.equal(0);
    });

    it('returns the balance when deposit(bytes32,bytes32,string,uint256,uint256,bytes32) is called', async function () {
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.mocaPoints
        .connect(depositor)
        ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
          this.currentSeason,
          parentNode,
          name,
          this.realmIdVersion,
          amount,
          depositReasonCode
        );

      this.balanceAfter = Number(await this.mocaPoints['balanceOf(uint256)'](this.realmId));
      expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
    });

    it('returns the balance when deposit(bytes32,uint256,uint256,uint256,bytes32) is called', async function () {
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.mocaPoints
        .connect(depositor)
        ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](this.currentSeason, this.realmId, this.realmIdVersion, amount, depositReasonCode);

      this.balanceAfter = Number(await this.mocaPoints['balanceOf(uint256)'](this.realmId));
      expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
    });
  });

  describe('balanceOf(bytes32,string)', function () {
    beforeEach(async function () {
      this.currentSeason = await this.mocaPoints.currentSeason();
      this.balanceBefore = Number(await this.mocaPoints['balanceOf(bytes32,string)'](parentNode, name));
    });

    it('returns 0 if the realmId does not exist', async function () {
      expect(this.balanceBefore).to.equal(0);
    });

    it('returns the balance when deposit(bytes32,bytes32,string,uint256,uint256,bytes32) is called', async function () {
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.mocaPoints
        .connect(depositor)
        ['deposit(bytes32,bytes32,string,uint256,uint256,bytes32)'](
          this.currentSeason,
          parentNode,
          name,
          this.realmIdVersion,
          amount,
          depositReasonCode
        );

      this.balanceAfter = Number(await this.mocaPoints['balanceOf(bytes32,string)'](parentNode, name));
      expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
    });

    it('returns the balance when deposit(bytes32,uint256,uint256,uint256,bytes32) is called', async function () {
      const depositReasonCode = ethers.encodeBytes32String('depositReason');
      await this.mocaPoints
        .connect(depositor)
        ['deposit(bytes32,uint256,uint256,uint256,bytes32)'](this.currentSeason, this.realmId, this.realmIdVersion, amount, depositReasonCode);

      this.balanceAfter = Number(await this.mocaPoints['balanceOf(bytes32,string)'](parentNode, name));
      expect(this.balanceAfter - this.balanceBefore).to.equal(amount);
    });
  });

  describe('preparePayload(uint256,uint256,bytes32)', function () {
    it('returns encoded Payload', async function () {
      const nonce = await this.mocaPoints.nonces(this.realmId);
      const currentSeason = await this.mocaPoints.currentSeason();

      const payload = await this.mocaPoints.preparePayload(this.realmId, amount, consumeReasonCode);
      const expectedPayload = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint256'],
        [this.realmId, this.realmIdVersion, amount, currentSeason, consumeReasonCode, nonce]
      );
      expect(payload).to.equal(expectedPayload);
    });
  });

  describe('Contract Upgrade', function () {
    beforeEach(async function () {
      this.MockMocaPointsUpgrade = await ethers.getContractFactory('MockMocaPointsUpgrade');
      this.mocaPointsV2 = await upgrades.upgradeProxy(this.mocaPoints.target, this.MockMocaPointsUpgrade.connect(owner));
    });

    it('reverts if a non owner authorizes an upgrade', async function () {
      await expect(upgrades.upgradeProxy(this.mocaPoints.target, this.MockMocaPointsUpgrade.connect(other))).to.be.reverted;
    });

    context('when successful', function () {
      it('owner authorizes an upgrade', async function () {
        await upgrades.upgradeProxy(this.mocaPoints.target, this.MockMocaPointsUpgrade.connect(owner));
      });

      it('re-initializes the contract', async function () {
        await this.mocaPointsV2.initializeV2();
        await expect(this.mocaPointsV2.initializeV2()).to.be.reverted;
      });

      it('calls to the new function', async function () {
        const val = 100;
        await this.mocaPointsV2.setVal(val);
        expect(await this.mocaPointsV2.val()).to.be.equal(val);
      });
    });
  });
});
