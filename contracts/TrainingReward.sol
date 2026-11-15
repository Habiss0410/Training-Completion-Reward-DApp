// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Training Completion Reward DApp
/// @notice Doanh nghiệp thưởng 0,015 ETH cho nhân viên hoàn thành khóa đào tạo
contract TrainingReward {
    // Mức thưởng cố định cho mỗi khóa
    uint256 public constant REWARD_AMOUNT = 0.015 ether;

    // Địa chỉ ví quản lý (người deploy)
    address public manager;

    struct Training {
        string name;     
        bool exists;     
    }

    // Tổng số khóa đã tạo (id chạy từ 1)
    uint256 public trainingCount;

    // trainingId => thông tin khóa
    mapping(uint256 => Training) private trainings;

    // trainingId => ví nhân viên => đã được xác nhận hoàn thành?
    mapping(uint256 => mapping(address => bool)) private completed;

    // trainingId => ví nhân viên => đã nhận thưởng?
    mapping(uint256 => mapping(address => bool)) private rewarded;

    // ----- Sự kiện (để giao diện và báo cáo theo dõi) -----
    event Funded(address indexed from, uint256 amount);
    event TrainingRegistered(uint256 indexed trainingId, string name);
    event CompletionApproved(uint256 indexed trainingId, address indexed employee);
    event RewardClaimed(uint256 indexed trainingId, address indexed employee, uint256 amount);

    // ----- Điều kiện chỉ quản lý -----
    modifier onlyManager() {
        require(msg.sender == manager, "Chi quan ly moi duoc thuc hien");
        _;
    }

    constructor() {
        manager = msg.sender;
    }

    /// @notice Cho phép nạp ETH vào quỹ thưởng (ai gửi ETH tới contract cũng được)
    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Quản lý tạo khóa đào tạo mới
    function registerTraining(string calldata name) external onlyManager returns (uint256) {
        require(bytes(name).length > 0, "Ten khoa hoc khong duoc rong");

        trainingCount += 1;
        trainings[trainingCount] = Training(name, true);

        emit TrainingRegistered(trainingCount, name);
        return trainingCount;
    }

    /// @notice Quản lý xác nhận một ví đã hoàn thành khóa
    function approveCompletion(uint256 trainingId, address employee) external onlyManager {
        require(trainings[trainingId].exists, "Khoa hoc khong ton tai");
        require(employee != address(0), "Dia chi vi khong hop le");
        require(!completed[trainingId][employee], "Da xac nhan hoan thanh roi");

        completed[trainingId][employee] = true;

        emit CompletionApproved(trainingId, employee);
    }

    /// @notice Nhân viên đã được xác nhận tự nhận thưởng (mỗi khóa một lần)
    function claimTrainingReward(uint256 trainingId) external {
        require(trainings[trainingId].exists, "Khoa hoc khong ton tai");
        require(completed[trainingId][msg.sender], "Chua duoc xac nhan hoan thanh");
        require(!rewarded[trainingId][msg.sender], "Da nhan thuong khoa nay roi");
        require(address(this).balance >= REWARD_AMOUNT, "Quy khong du ETH");

        // Cập nhật trạng thái TRƯỚC khi chuyển tiền (chống tấn công reentrancy)
        rewarded[trainingId][msg.sender] = true;

        (bool ok, ) = payable(msg.sender).call{value: REWARD_AMOUNT}("");
        require(ok, "Chuyen ETH that bai");

        emit RewardClaimed(trainingId, msg.sender, REWARD_AMOUNT);
    }

    /// @notice Kiểm tra ví đã nhận thưởng khóa này chưa
    function hasReceivedReward(uint256 trainingId, address employee) external view returns (bool) {
        return rewarded[trainingId][employee];
    }

    // ----- Hàm đọc phục vụ giao diện -----

    /// @notice Lấy tên khóa học
    function getTrainingName(uint256 trainingId) external view returns (string memory) {
        require(trainings[trainingId].exists, "Khoa hoc khong ton tai");
        return trainings[trainingId].name;
    }

    /// @notice Ví đã được xác nhận hoàn thành khóa này chưa
    function isCompleted(uint256 trainingId, address employee) external view returns (bool) {
        return completed[trainingId][employee];
    }

    /// @notice Số dư quỹ thưởng hiện tại của contract
    function fundBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
