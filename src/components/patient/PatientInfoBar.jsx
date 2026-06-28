import {
    Box,
    Flex,
    Text,
    Tooltip,
    IconButton,
    useColorMode,
} from "@chakra-ui/react";
import { FaEdit } from "react-icons/fa";
import { colors } from "../../theme/colors";
import { getAvatarColor, getInitials } from "../sidebar/SidebarHelpers";

const PatientInfoBar = ({ patient, onEdit }) => {
    const { colorMode } = useColorMode();
    const c = colors[colorMode];

    const name = patient.name || "New patient";
    const meta = [
        patient.gender,
        patient.dob,
        patient.ur_number && `UR ${patient.ur_number}`,
    ].filter(Boolean);

    return (
        <Flex justify="center" w="100%">
            <Flex
                className="panels-bg"
                borderRadius="lg"
                p={3}
                px={5}
                align="center"
                gap={4}
                maxW="100%"
            >
                <Flex
                    align="center"
                    justify="center"
                    boxSize="38px"
                    borderRadius="full"
                    bg={getAvatarColor(patient.name)}
                    color="#fff"
                    fontSize="sm"
                    fontWeight="700"
                    flexShrink={0}
                    sx={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                    {(patient.name && getInitials(patient.name)) || "?"}
                </Flex>

                <Box minW="0">
                    <Text
                        fontSize="lg"
                        fontWeight="700"
                        color={c.textPrimary}
                        noOfLines={1}
                        sx={{ fontFamily: '"Space Grotesk", sans-serif' }}
                    >
                        {name}
                    </Text>
                    <Text
                        fontSize="sm"
                        color={c.textSecondary}
                        noOfLines={1}
                        sx={{ fontFamily: '"Roboto", sans-serif' }}
                    >
                        {meta.length
                            ? meta.join("  ·  ")
                            : "No demographics yet"}
                    </Text>
                </Box>

                <Tooltip label="Edit patient details">
                    <IconButton
                        icon={<FaEdit />}
                        aria-label="Edit patient details"
                        size="sm"
                        variant="ghost"
                        color={c.textSecondary}
                        onClick={onEdit}
                        flexShrink={0}
                    />
                </Tooltip>
            </Flex>
        </Flex>
    );
};

export default PatientInfoBar;
