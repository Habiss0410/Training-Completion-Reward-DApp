const hre = require("hardhat");
const fs = require("fs");

async function main() {
  // Lấy địa chỉ contract từ file giao diện đang dùng
  const text = fs.readFileSync("frontend/contract-info.js", "utf8");
  const address = text.match(/"address":\s*"(0x[0-9a-fA-F]{40})"/)[1];

  const signers = await hre.ethers.getSigners();
  const manager = signers[0];
  const contract = await hre.ethers.getContractAt("TrainingReward", address, manager);
  const reward = await contract.REWARD_AMOUNT();

  let fund = await hre.ethers.provider.getBalance(address);
  console.log("Quy ban dau:", hre.ethers.formatEther(fund), "ETH");

  let i = 2; // bắt đầu từ ví #2, bỏ qua #0 (quản lý) và #1 (nhân viên đang test)
  while (fund >= reward) {
    const wallet = signers[i];
    await (await contract.approveCompletion(1, wallet.address)).wait();
    await (await contract.connect(wallet).claimTrainingReward(1)).wait();
    fund = await hre.ethers.provider.getBalance(address);
    console.log("Vi #" + i, "da nhan thuong. Quy con:", hre.ethers.formatEther(fund), "ETH");
    i++;
  }
  console.log("XONG. Quy con lai:", hre.ethers.formatEther(fund), "ETH (nho hon 0.015)");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
