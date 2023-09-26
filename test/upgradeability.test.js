// const {expect} = require('chai');
// const {ethers, upgrades} = require('hardhat');
// // const {expectRevert} = require('@openzeppelin/test-helpers');

// let admin, newAdmin, otherAccount;
// let proxyContract;
// let deployProxy;
// let MocaPoints;
// let MocaPointsV2;

// describe('Upgradeable MocaPoints', function () {
//   beforeEach(async function () {
//     [admin, newAdmin, otherAccount] = await ethers.getSigners();
//     MocaPoints = await ethers.getContractFactory('MocaPoints');
//     MocaPointsV2 = await ethers.getContractFactory('MocaPointsV2');
//     console.log('MocaPoints: ', MocaPoints);
//     console.log('MocaPointsV2: ', MocaPointsV2);
//   });

//   // it('should deploy the upgrade-able smart contract', async function () {
//   //   // Deploy
//   //   deployProxy = async () => {
//   //     const _proxy = await upgrades.deployProxy(Box, [200], {
//   //       initializer: 'set',
//   //       kind: 'uups',
//   //     });
//   //     await _proxy.deployed();
//   //     proxyContract = _proxy;
//   //   };
//   // });

//   // it('should should initialize correctly', async function () {
//   //   await deployProxy();
//   //   expect(await proxyContract.get()).be.equal(200);
//   //   expect(await proxyContract.owner()).be.equal(admin.address);

//   //   await expectRevert(proxyContract.set(200), 'Initializable: contract is already initialized');

//   //   await expectRevert(proxyContract.connect(newAdmin).set(200), 'Initializable: contract is already initialized');
//   // });

//   // it('should prevent un-authorized upgrade', async function () {
//   //   await expectRevert(upgrades.upgradeProxy(proxyContract.address, BoxV2.connect(newAdmin)), 'Unauthorized access');
//   // });

//   // it('should limit pause-ability functionality only to admin or proxy admin', async function () {
//   //   await expectRevert(proxyContract.connect(newAdmin).pause(), 'Ownable: caller is not the owner');
//   //   expect(await proxyContract.get()).be.equal(200);
//   //   await proxyContract.pause();
//   //   await expectRevert(proxyContract.connect(otherAccount).get(), 'Pausable: paused');
//   //   await proxyContract.connect(admin).unpause();
//   // });

//   // it('should be unpaused by admin', async function () {
//   //   expect(await proxyContract.get()).to.be.equal(200);
//   //   await proxyContract.increment();
//   //   expect(await proxyContract.get()).to.be.equal(199); // Buggy value; the correct one is 201; so time to fix the bug!
//   // });
// });

// // describe('Fixing a discovered bug', function () {
// //   // it('should produce buggy result', async function () {
// //   //   expect(await proxyContract.get()).to.be.equal(199);
// //   //   await proxyContract.increment();
// //   //   expect(await proxyContract.get()).to.be.equal(198); // Buggy value; the correct one is 201; so time to fix the bug!
// //   // });
// //   // it('should upgrade potential fix', async function () {
// //   //   proxyContract = await upgrades.upgradeProxy(proxyContract.address, BoxV2);
// //   // });
// //   // it('should emit Upgraded event', async function () {
// //   //   //! TODO check event emitting
// //   //   // await upgradeResult.deployTransaction.wait();
// //   //   // let { hash, receipt } = upgradeResult.deployTransaction
// //   //   // let implementation_address = await upgrades.erc1967.getImplementationAddress(proxyContract.address)
// //   //   // let _box = await Box.attach(implementation_address)
// //   //   // await expectEvent.inTransaction(hash, _box, "Upgraded");
// //   // });
// //   // it('should keep the storage intact', async function () {
// //   //   expect(await proxyContract.get()).be.equal(198);
// //   // });
// //   // it('should fix the bug', async function () {
// //   //   await proxyContract.increment();
// //   //   await proxyContract.increment();
// //   //   expect(await proxyContract.get()).to.be.equal(200);
// //   // });
// //   // it('should initialize the upgraded implementation', async function () {
// //   //   //! TODO how to add an initializer for new implementation?
// //   //   // await expectRevert(
// //   //   //   proxyContract.newInitializer(),
// //   //   //   "Initializable: contract is already initialized"
// //   //   // );
// //   // });
// //   // it('should change the proxy admin', async function () {
// //   //   await expect(proxyContract.transferOwnership(newAdmin.address))
// //   //     .to.emit(proxyContract, 'OwnershipTransferred')
// //   //     .withArgs(admin.address, newAdmin.address);
// //   //   expect(await proxyContract.owner()).not.be.equal(admin.address);
// //   //   await expectRevert(proxyContract.connect(admin).pause(), 'Ownable: caller is not the owner');
// //   //   expect(await proxyContract.owner()).be.equal(newAdmin.address);
// //   // });
// //   // it('should transfer ownership correctly', async function () {
// //   //   await proxyContract.connect(newAdmin).pause();
// //   //   await expectRevert(proxyContract.get(), 'Pausable: paused');
// //   //   await expectRevert(proxyContract.connect(newAdmin).get(), 'Pausable: paused');
// //   //   await proxyContract.connect(newAdmin).unpause();
// //   //   expect(await proxyContract.get()).to.be.equal(200);
// //   // });
// // });

// // describe('Add new variable', function () {
// //   // it('should upgrade', async function () {
// //   //   BoxV3 = await ethers.getContractFactory('BoxV3', newAdmin); // Upgrade by newAdmin
// //   //   proxyContract = await upgrades.upgradeProxy(proxyContract.address, BoxV3);
// //   // });
// //   // it('should keep the storage intact', async function () {
// //   //   expect(await proxyContract.get()).to.be.equal(200);
// //   // });
// //   // it('should keep the old functionalities intact', async function () {
// //   //   await proxyContract.increment();
// //   //   expect(await proxyContract.get()).be.equal(201);
// //   // });
// //   // it('should test new functionality', async function () {
// //   //   // Deposit and listen for the Event
// //   //   const otherAccountProxy = proxyContract.connect(otherAccount);
// //   //   expect(await otherAccountProxy.readDepositedAmount()).be.equal(0);
// //   //   await expectRevert(otherAccountProxy.deposit(0), '_amount > 0');
// //   //   await expect(otherAccountProxy.deposit(1)).to.emit(proxyContract, 'Deposited');
// //   //   expect(await otherAccountProxy.readDepositedAmount()).be.equal(1);
// //   //   await proxyContract.connect(newAdmin).pause();
// //   //   expect(await otherAccountProxy.readDepositedAmount()).be.equal(1);
// //   //   await expectRevert(otherAccountProxy.deposit(0), 'Pausable: paused');
// //   //   await proxyContract.connect(newAdmin).unpause();
// //   //   await expectRevert(otherAccountProxy.deposit(0), '_amount > 0');
// //   // });
// // });
