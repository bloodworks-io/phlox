// Component for configuring user-specific settings.
import {
    Box,
    Flex,
    IconButton,
    Text,
    Collapse,
    Input,
    Select,
    VStack,
    FormControl,
    FormLabel,
} from "@chakra-ui/react";
import { ChevronRightIcon, ChevronDownIcon } from "@chakra-ui/icons";
import { FaUser } from "react-icons/fa";

const UserSettingsPanel = ({
    isCollapsed,
    setIsCollapsed,
    userSettings,
    setUserSettings,
    specialties,
    templates,
    letterTemplates,
    toast,
}) => {
    const handleDefaultTemplateChange = (templateKey) => {
        setUserSettings((prev) => ({
            ...prev,
            default_template: templateKey,
        }));
    };
    const handleDefaultLetterTemplateChange = (templateId) => {
        setUserSettings((prev) => ({
            ...prev,
            default_letter_template_id: templateId,
        }));
    };
    return (
        <Box className="panels-bg" p="4" borderRadius="sm">
            <Flex align="center" justify="space-between">
                <Flex align="center">
                    <IconButton
                        icon={
                            isCollapsed ? (
                                <ChevronRightIcon />
                            ) : (
                                <ChevronDownIcon />
                            )
                        }
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        aria-label="Toggle collapse"
                        variant="outline"
                        size="sm"
                        mr="2"
                        className="collapse-toggle"
                    />
                    <FaUser size="1.2em" style={{ marginRight: "5px" }} />
                    <Text as="h3">User Settings</Text>
                </Flex>
            </Flex>
            <Collapse in={!isCollapsed} animateOpacity>
                <VStack spacing={4} align="stretch" mt={4}>
                    <Box>
                        <Text fontSize="sm" mb="1">
                            Name
                        </Text>
                        <Input
                            size="sm"
                            value={userSettings.name || ""}
                            onChange={(e) =>
                                setUserSettings((prev) => ({
                                    ...prev,
                                    name: e.target.value,
                                }))
                            }
                            className="input-style"
                            placeholder="Enter your name"
                        />
                    </Box>
                    <Box>
                        <Text fontSize="sm" mb="1">
                            Specialty
                        </Text>
                        <Select
                            size="sm"
                            value={userSettings.specialty || ""}
                            onChange={(e) =>
                                setUserSettings((prev) => ({
                                    ...prev,
                                    specialty: e.target.value,
                                }))
                            }
                            className="input-style"
                            placeholder="Select your specialty"
                        >
                            {specialties.map((specialty) => (
                                <option key={specialty} value={specialty}>
                                    {specialty}
                                </option>
                            ))}
                        </Select>
                    </Box>
                    <FormControl>
                        <FormLabel fontSize="sm">Default Template</FormLabel>
                        <Select
                            size="sm"
                            value={userSettings.default_template || ""}
                            onChange={(e) =>
                                handleDefaultTemplateChange(e.target.value)
                            }
                            className="input-style"
                            placeholder="Select default template"
                        >
                            {/* Change this part to map over templates array correctly */}
                            {templates.map((template) => (
                                <option
                                    key={template.template_key}
                                    value={template.template_key}
                                >
                                    {template.template_name}
                                </option>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl>
                        <FormLabel fontSize="sm">
                            Default Letter Template
                        </FormLabel>
                        <Select
                            size="sm"
                            value={
                                userSettings.default_letter_template_id || ""
                            }
                            onChange={(e) =>
                                handleDefaultLetterTemplateChange(
                                    e.target.value,
                                )
                            }
                            className="input-style"
                            placeholder="Select default letter template"
                        >
                            {letterTemplates.map((template) => (
                                <option key={template.id} value={template.id}>
                                    {template.name}
                                </option>
                            ))}
                        </Select>
                    </FormControl>
                </VStack>
            </Collapse>
        </Box>
    );
};

export default UserSettingsPanel;
