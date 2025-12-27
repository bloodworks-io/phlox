// Component containing patient's basic information fields for editing.
import React from "react";
import {
    Box,
    Flex,
    Input,
    IconButton,
    Select,
    Tooltip,
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import { BiMaleFemale } from "react-icons/bi";
import { FaUser, FaBirthdayCake, FaIdBadge } from "react-icons/fa";

const PatientInfoBar = ({ patient, setPatient, handleSearch }) => {
    const handleChange = (field, value) => {
        setPatient((prev) => ({ ...prev, [field]: value }));
    };

    return (
        <Flex justifyContent="center" alignItems="center" height="40px">
            <Box className="pill-box">
                <Tooltip label="Patient Name" aria-label="Patient Name Tooltip">
                    <Flex alignItems="center" flexBasis="25%">
                        <FaUser
                            style={{ marginRight: "8px" }}
                            className="pill-box-icons"
                        />
                        <Input
                            placeholder="Name"
                            size="sm"
                            value={patient.name || ""}
                            onChange={(e) =>
                                handleChange("name", e.target.value)
                            }
                            className="input-style"
                        />
                    </Flex>
                </Tooltip>
                <Tooltip label="Gender" aria-label="Gender Tooltip">
                    <Flex alignItems="center" flexBasis="15%">
                        <BiMaleFemale
                            style={{ marginRight: "8px", marginLeft: "8px" }}
                            className="pill-box-icons"
                        />
                        <Select
                            placeholder="M/F"
                            size="sm"
                            value={patient.gender || ""}
                            onChange={(e) =>
                                handleChange("gender", e.target.value)
                            }
                            className="input-style"
                        >
                            <option value="M">M</option>
                            <option value="F">F</option>
                        </Select>
                    </Flex>
                </Tooltip>
                <Tooltip
                    label="Date of Birth"
                    aria-label="Date of Birth Tooltip"
                >
                    <Flex alignItems="center" flexBasis="25%">
                        <FaBirthdayCake
                            style={{ marginRight: "8px", marginLeft: "8px" }}
                            className="pill-box-icons"
                        />
                        <Input
                            placeholder="Date of Birth"
                            type="date"
                            size="sm"
                            value={patient.dob || ""}
                            onChange={(e) =>
                                handleChange("dob", e.target.value)
                            }
                            className="input-style"
                        />
                    </Flex>
                </Tooltip>
                <Tooltip label="UR Number" aria-label="UR Number Tooltip">
                    <Flex alignItems="center" flexBasis="25%">
                        <FaIdBadge
                            style={{ marginRight: "8px", marginLeft: "8px" }}
                            className="pill-box-icons"
                        />
                        <Input
                            placeholder="UR Number"
                            size="sm"
                            value={patient.ur_number || ""}
                            onChange={(e) =>
                                handleChange("ur_number", e.target.value)
                            }
                            className="input-style"
                            sx={{
                                borderTopLeftRadius: "md !important",
                                borderBottomLeftRadius: "md !important",
                                borderTopRightRadius: "0 !important",
                                borderBottomRightRadius: "0 !important",
                            }}
                        />
                        <IconButton
                            icon={<SearchIcon />}
                            aria-label="Search UR Number"
                            size="sm"
                            onClick={() => handleSearch(patient.ur_number)}
                            className="search-button"
                        />
                    </Flex>
                </Tooltip>
            </Box>
        </Flex>
    );
};

export default PatientInfoBar;
