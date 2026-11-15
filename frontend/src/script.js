/*
    TRAINING COMPLETION REWARD DAPP
    ethers.js v6, MetaMask, async/await, try/catch/finally
*/

// STEP 1. Application state

const HARDHAT_CHAIN_ID = 31337n;

let provider = null;
let signer = null;
let contract = null;
let account = null;
let isManager = false;
let isProcessing = false;
let logCount = 0;

// STEP 2. Small helper functions

function $(id) {
    return document.getElementById(id);
}

function shortAddress(address) {
    return address.slice(0, 6) + "..." + address.slice(-4);
}

function errorMessage(error) {
    // Người dùng bấm Reject trong MetaMask
    if (error.code === "ACTION_REJECTED" || error.code === 4001) {
        return "Bạn đã từ chối giao dịch trong MetaMask.";
    }

    // Lý do revert do contract trả về
    if (error.reason) {
        return error.reason;
    }

    // Tìm lý do revert nằm sâu trong thông báo lỗi
    const raw = [
        error.info && error.info.error && error.info.error.message,
        error.error && error.error.message,
        error.shortMessage,
        error.message
    ].filter(Boolean).join(" | ");

    const match =
        raw.match(/reverted with reason string '([^']+)'/) ||
        raw.match(/execution reverted: ([^"|]+)/);

    if (match) {
        return match[1].trim();
    }

    return error.shortMessage || error.message || String(error);
}

// STEP 3. Display status, warnings and history log

function showStatus(message, type = "info") {
    const status = $("status");
    status.textContent = message;
    status.className = "status " + type;
}

function showWarning(message) {
    const warning = $("warning");
    warning.textContent = message;
    warning.classList.toggle("hidden", !message);
}

function addLog(message, type = "info") {
    const history = $("history");

    // Remove the "No transactions yet" placeholder
    if (logCount === 0) {
        history.innerHTML = "";
    }

    const item = document.createElement("div");
    item.className = "transaction " + type;
    item.textContent =
        new Date().toLocaleTimeString() + " | " + message;

    history.prepend(item);

    logCount++;
    $("logCount").textContent = logCount + " sự kiện";
}

// STEP 4. Enable or disable controls while a transaction is pending

function setProcessing(processing) {
    isProcessing = processing;

    document.querySelectorAll(".lockable").forEach(function (element) {
        element.disabled =
            processing || element.dataset.locked === "true";
    });
}

// STEP 5. Build small UI pieces

function createChip(text, cssClass) {
    const chip = document.createElement("span");
    chip.className = "chip " + cssClass;
    chip.textContent = text;
    return chip;
}

function createCourseCard(id, name, done, received) {
    const card = document.createElement("div");
    card.className = "course";

    // Top: ID + name
    const top = document.createElement("div");
    top.className = "course-top";

    const idBox = document.createElement("span");
    idBox.className = "course-id";
    idBox.textContent = "#" + id;

    const title = document.createElement("h4");
    title.textContent = name;

    top.append(idBox, title);

    // Chips: completed / rewarded
    const chips = document.createElement("div");
    chips.className = "chips";
    chips.append(
        done
            ? createChip("✔ Đã xác nhận hoàn thành", "chip-yes")
            : createChip("✖ Chưa xác nhận", "chip-no"),
        received
            ? createChip("💰 Đã nhận thưởng", "chip-yes")
            : createChip("⏳ Chưa nhận thưởng", "chip-wait")
    );

    // Claim button
    const button = document.createElement("button");
    button.className = "green lockable";

    const canClaim = done && !received;
    button.dataset.locked = canClaim ? "false" : "true";
    button.disabled = isProcessing || !canClaim;

    if (received) {
        button.textContent = "Đã nhận thưởng";
    } else if (done) {
        button.textContent = "Nhận thưởng 0.015 ETH";
    } else {
        button.textContent = "Chưa đủ điều kiện nhận";
    }

    button.addEventListener("click", function () {
        claimReward(id);
    });

    card.append(top, chips, button);
    return card;
}

// STEP 6. Connect wallet (MetaMask)

async function connectWallet() {
    if (!window.ethereum) {
        showWarning("Chưa cài MetaMask. Hãy cài tiện ích MetaMask cho trình duyệt.");
        return;
    }

    if (typeof CONTRACT_INFO === "undefined") {
        showWarning("Không tìm thấy contract-info.js. Hãy chạy lại lệnh deploy.");
        return;
    }

    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);

        const network = await provider.getNetwork();
        $("networkPill").textContent = "Chain " + network.chainId;

        if (network.chainId !== HARDHAT_CHAIN_ID) {
            showWarning(
                "Sai mạng (chainId " + network.chainId +
                "). Hãy chuyển MetaMask sang Hardhat Local (31337)."
            );
            return;
        }

        const code = await provider.getCode(CONTRACT_INFO.address);
        if (code === "0x") {
            showWarning(
                "Không thấy contract trên mạng. Node Hardhat có thể đã khởi động lại: hãy chạy lại lệnh deploy."
            );
            return;
        }

        showWarning("");

        signer = await provider.getSigner();
        account = await signer.getAddress();
        contract = new ethers.Contract(
            CONTRACT_INFO.address,
            CONTRACT_INFO.abi,
            signer
        );

        $("account").textContent = shortAddress(account);
        $("account").title = account;
        $("lookupPanel").classList.remove("hidden");

        addLog("Đã kết nối ví " + account, "ok");
        showStatus("Kết nối thành công.", "ok");

        await refresh();

    } catch (error) {
        showStatus("Kết nối lỗi: " + errorMessage(error), "err");
        addLog("Kết nối lỗi: " + errorMessage(error), "err");
    }
}

// STEP 7. Read data from the contract and update the interface

async function refresh() {
    const manager = await contract.manager();
    isManager = manager.toLowerCase() === account.toLowerCase();

    // Role
    const role = $("rolePill");
    role.textContent = isManager ? "👑 Quản lý" : "👤 Nhân viên";
    role.className = "pill " + (isManager ? "pill-purple" : "pill-green");
    $("managerPanel").classList.toggle("hidden", !isManager);

    // Fund balance + how many rewards it can still pay
    const fundWei = await contract.fundBalance();
    const rewardWei = await contract.REWARD_AMOUNT();
    const rounds = Number(fundWei / rewardWei);

    $("fund").textContent = ethers.formatEther(fundWei);
    $("fundRounds").textContent = "Đủ cho " + rounds + " lượt thưởng";

    const bar = $("fundBar");
    bar.style.width = Math.min(100, rounds * 10) + "%";
    bar.classList.toggle("low", rounds < 2);

    // Courses
    const count = Number(await contract.trainingCount());
    $("courseCount").textContent = count;

    const list = $("courses");
    list.innerHTML = "";

    if (count === 0) {
        list.innerHTML =
            "<div class='empty'>Chưa có khóa học nào.</div>";
        $("myRewards").textContent = 0;
        return;
    }

    let myRewards = 0;

    for (let id = 1; id <= count; id++) {
        const name = await contract.getTrainingName(id);
        const done = await contract.isCompleted(id, account);
        const received = await contract.hasReceivedReward(id, account);

        if (received) myRewards++;

        list.appendChild(createCourseCard(id, name, done, received));
    }

    $("myRewards").textContent = myRewards;
}

// STEP 8. Send a transaction (shared by every write function)

async function sendTransaction(label, action) {
    if (isProcessing) return;

    try {
        setProcessing(true);
        showStatus(label + ": hãy xác nhận trong MetaMask...", "processing");

        const tx = await action();

        showStatus(label + ": đang chờ khối xác nhận...", "processing");
        addLog(label + " đã gửi, hash " + tx.hash.slice(0, 18) + "...", "info");

        await tx.wait();

        showStatus(label + " THÀNH CÔNG!", "ok");
        addLog(label + ": THÀNH CÔNG", "ok");

        await refresh();
        return true;

    } catch (error) {
        showStatus(label + " THẤT BẠI: " + errorMessage(error), "err");
        addLog(label + ": THẤT BẠI - " + errorMessage(error), "err");
        return false;

    } finally {
        setProcessing(false);
    }
}

// STEP 9. claimTrainingReward()

function claimReward(id) {
    return sendTransaction(
        "claimTrainingReward(" + id + ")",
        function () {
            return contract.claimTrainingReward(id);
        }
    );
}

// STEP 10. registerTraining() - manager only

async function registerTraining() {
    const name = $("newName").value.trim();

    if (name === "") {
        showStatus("Hãy nhập tên khóa học.", "err");
        return;
    }

    const ok = await sendTransaction(
        "registerTraining",
        function () {
            return contract.registerTraining(name);
        }
    );

    if (ok) $("newName").value = "";
}

// STEP 11. approveCompletion() - manager only

async function approveCompletion() {
    const id = Number($("apvId").value);
    const address = $("apvAddr").value.trim();

    if (!Number.isSafeInteger(id) || id <= 0) {
        showStatus("ID khóa phải là số nguyên dương.", "err");
        return;
    }

    if (!ethers.isAddress(address)) {
        showStatus("Địa chỉ ví không hợp lệ.", "err");
        return;
    }

    await sendTransaction(
        "approveCompletion(" + id + ")",
        function () {
            return contract.approveCompletion(id, address);
        }
    );
}

// STEP 12. Fund the reward pool

async function fundPool() {
    const amountText = $("fundAmt").value;
    const amount = Number(amountText);

    if (amountText.trim() === "" || !(amount > 0)) {
        showStatus("Hãy nhập số ETH lớn hơn 0.", "err");
        return;
    }

    const ok = await sendTransaction(
        "Nạp quỹ " + amountText + " ETH",
        function () {
            return signer.sendTransaction({
                to: CONTRACT_INFO.address,
                value: ethers.parseEther(amountText)
            });
        }
    );

    if (ok) $("fundAmt").value = "";
}

// STEP 13. hasReceivedReward() lookup (read-only, no gas)

async function lookupReward() {
    const id = Number($("lkId").value);
    const address = $("lkAddr").value.trim();
    const result = $("lkResult");

    if (!Number.isSafeInteger(id) || id <= 0 || !ethers.isAddress(address)) {
        result.textContent = "Nhập ID khóa và địa chỉ ví hợp lệ.";
        result.style.color = "#b91c1c";
        return;
    }

    try {
        const done = await contract.isCompleted(id, address);
        const received = await contract.hasReceivedReward(id, address);

        result.textContent =
            "Khóa " + id + " | hoàn thành: " + (done ? "CÓ" : "KHÔNG") +
            " | đã nhận thưởng: " + (received ? "CÓ" : "KHÔNG");
        result.style.color = "#15803d";

        addLog("Tra cứu khóa " + id + " cho " + shortAddress(address), "info");

    } catch (error) {
        result.textContent = "Tra cứu lỗi: " + errorMessage(error);
        result.style.color = "#b91c1c";
    }
}

// STEP 14. Initialize application

function initializeApp() {
    const connectButton = $("connectBtn");

    if (!connectButton) {
        console.error("Required buttons not found. Check index.html.");
        return;
    }

    connectButton.addEventListener("click", connectWallet);
    $("registerBtn").addEventListener("click", registerTraining);
    $("approveBtn").addEventListener("click", approveCompletion);
    $("fundBtn").addEventListener("click", fundPool);
    $("lookupBtn").addEventListener("click", lookupReward);

    // Reload when the user switches wallet account or network
    if (window.ethereum) {
        window.ethereum.on("accountsChanged", function () {
            location.reload();
        });
        window.ethereum.on("chainChanged", function () {
            location.reload();
        });
    }

    console.log("Training Reward DApp is ready!");
}

// STEP 15. Wait until HTML is ready

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApp);
} else {
    initializeApp();
}
