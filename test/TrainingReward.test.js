const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TrainingReward", function () {
  let contract, manager, employee, other;
  const REWARD = ethers.parseEther("0.015");

  beforeEach(async function () {
    [manager, employee, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("TrainingReward");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  // Hàm phụ: nạp quỹ 0.1 ETH
  async function fund() {
    await manager.sendTransaction({
      to: await contract.getAddress(),
      value: ethers.parseEther("0.1"),
    });
  }

  it("1. Nguoi deploy la quan ly", async function () {
    expect(await contract.manager()).to.equal(manager.address);
  });

  it("2. Quan ly tao duoc khoa hoc", async function () {
    await contract.registerTraining("An toan lao dong");
    expect(await contract.trainingCount()).to.equal(1);
    expect(await contract.getTrainingName(1)).to.equal("An toan lao dong");
  });

  it("3. Nguoi khac KHONG tao duoc khoa hoc", async function () {
    await expect(
      contract.connect(employee).registerTraining("Khoa gia")
    ).to.be.revertedWith("Chi quan ly moi duoc thuc hien");
  });

  it("4. Nguoi khac KHONG xac nhan hoan thanh duoc", async function () {
    await contract.registerTraining("Khoa A");
    await expect(
      contract.connect(employee).approveCompletion(1, employee.address)
    ).to.be.revertedWith("Chi quan ly moi duoc thuc hien");
  });

  it("5. Vi chua duoc xac nhan KHONG nhan duoc thuong", async function () {
    await fund();
    await contract.registerTraining("Khoa A");
    await expect(
      contract.connect(employee).claimTrainingReward(1)
    ).to.be.revertedWith("Chua duoc xac nhan hoan thanh");
  });

  it("6. Vi hoan thanh nhan duoc dung 0.015 ETH", async function () {
    await fund();
    await contract.registerTraining("Khoa A");
    await contract.approveCompletion(1, employee.address);

    await expect(
      contract.connect(employee).claimTrainingReward(1)
    ).to.changeEtherBalances([employee, contract], [REWARD, -REWARD]);

    expect(await contract.hasReceivedReward(1, employee.address)).to.equal(true);
  });

  it("7. KHONG nhan thuong 2 lan cung mot khoa", async function () {
    await fund();
    await contract.registerTraining("Khoa A");
    await contract.approveCompletion(1, employee.address);
    await contract.connect(employee).claimTrainingReward(1);

    await expect(
      contract.connect(employee).claimTrainingReward(1)
    ).to.be.revertedWith("Da nhan thuong khoa nay roi");
  });

  it("8. Nhan thuong duoc o khoa hoc khac", async function () {
    await fund();
    await contract.registerTraining("Khoa A");
    await contract.registerTraining("Khoa B");
    await contract.approveCompletion(1, employee.address);
    await contract.approveCompletion(2, employee.address);

    await contract.connect(employee).claimTrainingReward(1);
    await contract.connect(employee).claimTrainingReward(2);

    expect(await contract.hasReceivedReward(1, employee.address)).to.equal(true);
    expect(await contract.hasReceivedReward(2, employee.address)).to.equal(true);
  });

  it("9. Quy khong du ETH thi tu choi", async function () {
    // Khong nap quy
    await contract.registerTraining("Khoa A");
    await contract.approveCompletion(1, employee.address);
    await expect(
      contract.connect(employee).claimTrainingReward(1)
    ).to.be.revertedWith("Quy khong du ETH");
  });

  it("10. Xac nhan khoa khong ton tai bi tu choi", async function () {
    await expect(
      contract.approveCompletion(99, employee.address)
    ).to.be.revertedWith("Khoa hoc khong ton tai");
  });

  it("11. Vi khac khong bi anh huong khi nhan thuong", async function () {
    await fund();
    await contract.registerTraining("Khoa A");
    await contract.approveCompletion(1, employee.address);
    expect(await contract.hasReceivedReward(1, other.address)).to.equal(false);
    await expect(
      contract.connect(other).claimTrainingReward(1)
    ).to.be.revertedWith("Chua duoc xac nhan hoan thanh");
  });
});
