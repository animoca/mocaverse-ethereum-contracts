const {expect} = require('chai');
const {MerkleTree} = require('merkletreejs');
const {ethers, upgrades} = require('hardhat');
const {loadFixture} = require('@animoca/ethereum-contract-helpers/src/test/fixtures');

describe('SeasonalCumulativeMerkleClaim Contract', function () {
  let owner, admin, other;

  const amount = 100;
  //test.moca
  const parentNode = ethers.encodeBytes32String('moca');
  const name = 'test';

  //season
  const seasonStr = 'Season1';
  const currentSeason = ethers.encodeBytes32String(seasonStr);

  before(async function () {
    [owner, admin, other] = await ethers.getSigners();
  });

  const fixture = async function () {
    // Deploy the MockRealmId contract
    const MockRealmIdContract = await ethers.getContractFactory('MockRealmId');
    this.mockRealmId = await MockRealmIdContract.deploy();
    this.mockRealmIdAddress = this.mockRealmId.target;

    this.realmId = await this.mockRealmId.getTokenId(name, parentNode);
    this.realmIdVersion = await this.mockRealmId.burnCounts(this.realmId);

    // Deploy the RealmPoints contract
    this.RealmPointsContract = await ethers.getContractFactory('RealmPoints');
    this.realmPoints = await upgrades.deployProxy(this.RealmPointsContract, [], {
      initializer: 'initialize',
      kind: 'uups',
      constructorArgs: [this.mockRealmIdAddress],
    });

    await this.realmPoints.connect(owner).grantRole(ethers.keccak256(Buffer.from('ADMIN_ROLE')), admin.address);
    await this.realmPoints.connect(admin).setCurrentSeason(currentSeason);

    const SeasonalCumulativeMerkleClaimContract = await ethers.getContractFactory('SeasonalCumulativeMerkleClaim');
    this.claimContract = await SeasonalCumulativeMerkleClaimContract.deploy(this.realmPoints.target);
    await this.realmPoints.connect(owner).grantRole(ethers.keccak256(Buffer.from('DEPOSITOR_ROLE')), this.claimContract.target);
  };

  beforeEach(async function () {
    await loadFixture(fixture, this);
  });

  describe('constructor(address)', function () {
    it('should revert if the RealmPoints contract address is the zero address', async function () {
      const SeasonalCumulativeMerkleClaimContract = await ethers.getContractFactory('SeasonalCumulativeMerkleClaim');
      await expect(SeasonalCumulativeMerkleClaimContract.deploy(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(this.claimContract, 'InvalidRealmPointsContractAddress')
        .withArgs(ethers.ZeroAddress);
    });
  });

  describe('pause(season)', function () {
    it('reverts if the caller is not an owner', async function () {
      await expect(this.claimContract.connect(other).pause(currentSeason))
        .to.be.revertedWithCustomError(this.claimContract, 'NotContractOwner')
        .withArgs(other.address);
    });

    it('reverts if the season does not have a merkle root', async function () {
      await expect(this.claimContract.connect(owner).pause(currentSeason))
        .to.be.revertedWithCustomError(this.claimContract, 'MerkleRootNotExists')
        .withArgs(currentSeason);
    });

    it('reverts it the season is already paused', async function () {
      const root = ethers.keccak256(ethers.toUtf8Bytes('root'));
      await this.claimContract.connect(owner).setMerkleRoot(currentSeason, root);
      await this.claimContract.connect(owner).pause(currentSeason);
      await expect(this.claimContract.connect(owner).pause(currentSeason))
        .to.be.revertedWithCustomError(this.claimContract, 'SeasonIsPaused')
        .withArgs(currentSeason);
    });

    context('when successful', function () {
      beforeEach(async function () {
        const root = ethers.keccak256(ethers.toUtf8Bytes('root'));
        await this.claimContract.connect(owner).setMerkleRoot(currentSeason, root);
        this.receipt = await this.claimContract.connect(owner).pause(currentSeason);
      });

      it('pauses the season', async function () {
        expect(await this.claimContract.paused(currentSeason)).to.be.true;
      });

      it('emits Pause event', async function () {
        await expect(this.receipt).to.emit(this.claimContract, 'Pause').withArgs(currentSeason);
      });
    });
  });

  describe('unpause(season)', function () {
    it('reverts if the caller is not an owner', async function () {
      await expect(this.claimContract.connect(other).unpause(currentSeason))
        .to.be.revertedWithCustomError(this.claimContract, 'NotContractOwner')
        .withArgs(other.address);
    });

    it('reverts if the season does not have a merkle root', async function () {
      await expect(this.claimContract.connect(owner).unpause(currentSeason))
        .to.be.revertedWithCustomError(this.claimContract, 'MerkleRootNotExists')
        .withArgs(currentSeason);
    });

    it('reverts if the season is not paused', async function () {
      const root = ethers.keccak256(ethers.toUtf8Bytes('root'));
      await this.claimContract.connect(owner).setMerkleRoot(currentSeason, root);
      await expect(this.claimContract.connect(owner).unpause(currentSeason))
        .to.be.revertedWithCustomError(this.claimContract, 'SeasonNotPaused')
        .withArgs(currentSeason);
    });

    context('when successful', function () {
      beforeEach(async function () {
        const root = ethers.keccak256(ethers.toUtf8Bytes('root'));
        await this.claimContract.connect(owner).setMerkleRoot(currentSeason, root);
        await this.claimContract.connect(owner).pause(currentSeason);
        this.receipt = await this.claimContract.connect(owner).unpause(currentSeason);
      });

      it('unpauses the season', async function () {
        expect(await this.claimContract.paused(currentSeason)).to.be.false;
      });

      it('emits unPause event', async function () {
        await expect(this.receipt).to.emit(this.claimContract, 'Unpause').withArgs(currentSeason);
      });
    });
  });

  describe('setMerkleRoot(season, bytes32)', function () {
    it('reverts if the caller is not an owner', async function () {
      await expect(this.claimContract.connect(other).setMerkleRoot(currentSeason, ethers.ZeroHash))
        .to.be.revertedWithCustomError(this.claimContract, 'NotContractOwner')
        .withArgs(other.address);
    });

    it('reverts if the season is not valid', async function () {
      await expect(this.claimContract.connect(owner).setMerkleRoot(ethers.ZeroHash, ethers.ZeroHash))
        .to.be.revertedWithCustomError(this.claimContract, 'InvalidSeason')
        .withArgs(ethers.ZeroHash);
    });

    it('reverts if the contract is not paused and try to update an exisitng root', async function () {
      const root = ethers.keccak256(ethers.toUtf8Bytes('root'));
      await this.claimContract.connect(owner).setMerkleRoot(currentSeason, root);
      await expect(this.claimContract.connect(owner).setMerkleRoot(currentSeason, root))
        .to.be.revertedWithCustomError(this.claimContract, 'SeasonNotPaused')
        .withArgs(currentSeason);
    });

    context('when successful (new root)', function () {
      const root = ethers.keccak256(ethers.toUtf8Bytes('root'));

      beforeEach(async function () {
        this.oldNonce = await this.claimContract.nonces(currentSeason);
        this.receipt = await this.claimContract.connect(owner).setMerkleRoot(currentSeason, root);
      });

      it('increments the nonce', async function () {
        expect(await this.claimContract.nonces(currentSeason)).to.equal(this.oldNonce + 1n);
      });

      it('emits MerkleRootSet event', async function () {
        await expect(this.receipt).to.emit(this.claimContract, 'MerkleRootSet').withArgs(currentSeason, root);
      });

      it('unpauses the season', async function () {
        expect(await this.claimContract.paused(currentSeason)).to.be.false;
      });
    });

    context('when successful (update root)', function () {
      const root = ethers.keccak256(ethers.toUtf8Bytes('root'));

      beforeEach(async function () {
        await this.claimContract.connect(owner).setMerkleRoot(currentSeason, root);
        this.oldNonce = await this.claimContract.nonces(currentSeason);
        await this.claimContract.connect(owner).pause(currentSeason);
        this.receipt = await this.claimContract.connect(owner).setMerkleRoot(currentSeason, root);
      });

      it('increments the nonce', async function () {
        expect(await this.claimContract.nonces(currentSeason)).to.equal(this.oldNonce + 1n);
      });

      it('emits MerkleRootSet event', async function () {
        await expect(this.receipt).to.emit(this.claimContract, 'MerkleRootSet').withArgs(currentSeason, root);
      });

      it('unpauses the season', async function () {
        expect(await this.claimContract.paused(currentSeason)).to.be.false;
      });
    });
  });

  describe('claimPayout(bytes32,uint256,uint256,uint256,bytes32,bytes32)', function () {
    const amount = 1n;

    it('revets if the amount is not valid', async function () {
      await expect(this.claimContract.connect(other).claimPayout(currentSeason, 0, 0, 0, ethers.ZeroHash, [ethers.ZeroHash]))
        .to.be.revertedWithCustomError(this.claimContract, 'InvalidClaimAmount')
        .withArgs(0);
    });

    it('reverts if the season is paused', async function () {
      const root = ethers.keccak256(ethers.toUtf8Bytes('root'));
      await this.claimContract.connect(owner).setMerkleRoot(currentSeason, root);
      await this.claimContract.connect(owner).pause(currentSeason);

      await expect(this.claimContract.connect(other).claimPayout(currentSeason, 0, 0, amount, ethers.ZeroHash, [ethers.ZeroHash]))
        .to.be.revertedWithCustomError(this.claimContract, 'SeasonIsPaused')
        .withArgs(currentSeason);
    });

    it('reverts if the merkle root does not exists', async function () {
      const invalidSeason = ethers.encodeBytes32String('invalidSeason');
      await expect(this.claimContract.connect(other).claimPayout(invalidSeason, 0, 0, amount, ethers.ZeroHash, [ethers.ZeroHash]))
        .to.be.revertedWithCustomError(this.claimContract, 'MerkleRootNotExists')
        .withArgs(invalidSeason);
    });

    context('with a merkle root set', function () {
      beforeEach(async function () {
        this.nextNonce = (await this.claimContract.nonces(currentSeason)) + 1n;
        this.depositReasonCode = ethers.keccak256(ethers.toUtf8Bytes('testReasonCode'));
        this.rawLeafs = [
          {
            season: currentSeason,
            realmId: 1,
            realmIdVersion: 0,
            amount: 1n,
            depositReasonCode: this.depositReasonCode,
            nonce: this.nextNonce,
          },
        ];
        this.leafs = this.rawLeafs.map((el) =>
          ethers.solidityPacked(
            ['bytes32', 'uint256', 'uint256', 'uint256', 'bytes32', 'uint256'],
            [el.season, el.realmId, el.realmIdVersion, el.amount, el.depositReasonCode, el.nonce]
          )
        );
        this.tree = new MerkleTree(this.leafs, ethers.keccak256, {hashLeaves: true, sortPairs: true});
        this.root = this.tree.getHexRoot();
        await this.claimContract.connect(owner).setMerkleRoot(currentSeason, this.root);
      });

      it('reverts with InvalidProof if the proof cannot be verified', async function () {
        await expect(
          this.claimContract.claimPayout(
            this.rawLeafs[0].season,
            0,
            this.rawLeafs[0].realmIdVersion,
            this.rawLeafs[0].amount,
            this.rawLeafs[0].depositReasonCode,
            this.tree.getHexProof(ethers.keccak256(this.leafs[0]))
          )
        )
          .to.revertedWithCustomError(this.claimContract, 'InvalidProof')
          .withArgs(
            this.rawLeafs[0].season,
            0,
            this.rawLeafs[0].realmIdVersion,
            this.rawLeafs[0].amount,
            this.rawLeafs[0].depositReasonCode,
            this.nextNonce
          );
      });

      it('reverts with AlreadyClaimed if the leaf is claimed twice', async function () {
        await this.claimContract.claimPayout(
          this.rawLeafs[0].season,
          this.rawLeafs[0].realmId,
          this.rawLeafs[0].realmIdVersion,
          this.rawLeafs[0].amount,
          this.rawLeafs[0].depositReasonCode,
          this.tree.getHexProof(ethers.keccak256(this.leafs[0]))
        );

        await expect(
          this.claimContract.claimPayout(
            this.rawLeafs[0].season,
            this.rawLeafs[0].realmId,
            this.rawLeafs[0].realmIdVersion,
            this.rawLeafs[0].amount,
            this.rawLeafs[0].depositReasonCode,
            this.tree.getHexProof(ethers.keccak256(this.leafs[0]))
          )
        )
          .to.revertedWithCustomError(this.claimContract, 'AlreadyClaimed')
          .withArgs(
            this.rawLeafs[0].season,
            this.rawLeafs[0].realmId,
            this.rawLeafs[0].realmIdVersion,
            this.rawLeafs[0].amount,
            this.rawLeafs[0].depositReasonCode,
            this.nextNonce
          );
      });

      context('when successful', function () {
        beforeEach(async function () {
          this.receipt = await this.claimContract.claimPayout(
            this.rawLeafs[0].season,
            this.rawLeafs[0].realmId,
            this.rawLeafs[0].realmIdVersion,
            this.rawLeafs[0].amount,
            this.rawLeafs[0].depositReasonCode,
            this.tree.getHexProof(ethers.keccak256(this.leafs[0]))
          );
        });

        it('emits a PayoutClaimed event', async function () {
          await expect(this.receipt)
            .to.emit(this.claimContract, 'PayoutClaimed')
            .withArgs(
              this.rawLeafs[0].season,
              this.root,
              this.rawLeafs[0].realmId,
              this.rawLeafs[0].realmIdVersion,
              this.rawLeafs[0].amount,
              this.rawLeafs[0].depositReasonCode,
              this.nextNonce
            );
        });
      });
    });
  });
});
