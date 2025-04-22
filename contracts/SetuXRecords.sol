// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SetuXRecords {
    struct MedicalRecord {
        string date;
        address hospitalAddress;
        string recordHash;
    }

    address public admin;

    mapping(address => bool) public isHospital;
    mapping(address => bool) public isPatient;
    mapping(address => string) public hospitalNames;
    mapping(address => MedicalRecord[]) private patientRecords;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyHospital() {
        require(isHospital[msg.sender], "Only hospital can perform this action");
        _;
    }

    modifier onlyPatient() {
        require(isPatient[msg.sender], "Only patient can perform this action");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // 🔐 Admin-only hospital registration
    function registerHospital(address hospitalAddress, string memory name) public onlyAdmin {
        isHospital[hospitalAddress] = true;
        hospitalNames[hospitalAddress] = name;
    }
    
    // 🏥 Self-registering hospitals
    function selfRegisterAsHospital(string memory name) public {
        require(!isHospital[msg.sender], "Already registered as hospital");
        isHospital[msg.sender] = true;
        hospitalNames[msg.sender] = name;
    }


    // 👤 Self-registering patients
    function registerPatient() public {
        require(!isPatient[msg.sender], "Already registered as patient");
        isPatient[msg.sender] = true;
    }

    // ➕ Hospital adds record (now saves hospitalAddress instead of name directly)
    function addRecord(
        address patientAddress,
        string memory date,
        string memory recordHash
    ) public onlyHospital {
        require(isPatient[patientAddress], "Patient is not registered");

        patientRecords[patientAddress].push(MedicalRecord(
            date,
            msg.sender, // hospitalAddress
            recordHash
        ));
    }

    // 🔍 Get records (accessible by patient, hospital, or admin)
    function getRecords(address patientAddress) public view returns (MedicalRecord[] memory) {
        require(
            msg.sender == patientAddress || isHospital[msg.sender] || msg.sender == admin,
            "Unauthorized access"
        );
        return patientRecords[patientAddress];
    }

    // 🏥 Fetch hospital name from address
    function getHospitalName(address hospitalAddress) public view returns (string memory) {
        return hospitalNames[hospitalAddress];
    }
}
