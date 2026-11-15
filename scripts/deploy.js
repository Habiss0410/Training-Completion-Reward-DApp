const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [manager] = await hre.ethers.getSigners();
  console.log("Ví quản lý (deployer):", manager.address);

  // 1. Deploy contract
  const Factory = await hre.ethers.getContractFactory("TrainingReward");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("Contract da deploy tai:", address);

  // 2. Nạp quỹ ban đầu 0.1 ETH
  const tx = await manager.sendTransaction({
    to: address,
    value: hre.ethers.parseEther("0.1"),
  });
  await tx.wait();
  const balance = await hre.ethers.provider.getBalance(address);
  console.log("Quy thuong sau khi nap:", hre.ethers.formatEther(balance), "ETH");

  // 3. Tạo sẵn 2 khóa học mẫu
  await (await contract.registerTraining("An toan lao dong")).wait();
  await (await contract.registerTraining("Ky nang giao tiep")).wait();
  console.log("Tong so khoa hoc:", (await contract.trainingCount()).toString());

  // 4. Lưu địa chỉ + ABI cho giao diện web dùng ở Bước 5
  const artifact = await hre.artifacts.readArtifact("TrainingReward");
  const info = { address, abi: artifact.abi };
  fs.writeFileSync("frontend/contract-info.js",
    "const CONTRACT_INFO = " + JSON.stringify(info, null, 2) + ";\n");
  console.log("Da ghi frontend/contract-info.js");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
