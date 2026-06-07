// Component for configuring user-specific settings.
import {
  Box,
  Flex,
  HStack,
  IconButton,
  Text,
  Collapse,
  Input,
  Select,
  Switch,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  VStack,
  FormControl,
  FormLabel,
} from "@chakra-ui/react";
import { ChevronRightIcon, ChevronDownIcon } from "@chakra-ui/icons";
import { FaUser, FaCog } from "react-icons/fa";

const ADVANCED_OPTIONS_SCHEMA = [
  {
    key: "store_original_pdfs",
    label: "Store Original PDFs",
    description:
      "Keep original PDF files in the database after upload. Increases storage usage.",
    type: "boolean",
    defaultValue: false,
  },
];

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
  const handleAdvancedOptionChange = (key, value) => {
    setUserSettings((prev) => ({
      ...prev,
      advanced_options: {
        ...(prev.advanced_options || {}),
        [key]: value,
      },
    }));
  };
  return (
    <Box className="panels-bg" p="4" borderRadius="sm">
      <Flex align="center" justify="space-between">
        <Flex align="center">
          <IconButton
            icon={isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
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
        <Tabs variant="enclosed" mt={4}>
          <TabList>
            <Tab className="tab-style">
              <HStack>
                <FaUser />
                <Text>General</Text>
              </HStack>
            </Tab>
            <Tab className="tab-style">
              <HStack>
                <FaCog />
                <Text>Advanced</Text>
              </HStack>
            </Tab>
          </TabList>
          <TabPanels>
            <TabPanel className="floating-main">
              <VStack spacing={4} align="stretch">
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
                  <FormLabel fontSize="sm" fontWeight={"bold"}>
                    Default Template
                  </FormLabel>
                  <Select
                    size="sm"
                    value={userSettings.default_template || ""}
                    onChange={(e) => handleDefaultTemplateChange(e.target.value)}
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
                  <FormLabel fontSize="sm" fontWeight={"bold"}>
                    Default Letter Template
                  </FormLabel>
                  <Select
                    size="sm"
                    value={userSettings.default_letter_template_id || ""}
                    onChange={(e) =>
                      handleDefaultLetterTemplateChange(e.target.value)
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
            </TabPanel>
            <TabPanel className="floating-main">
              <Text fontSize="sm" mb={4} className="pill-box-icons">
                These options are intended for advanced users. Changing them may
                affect storage or performance.
              </Text>
              <VStack spacing={3} align="stretch">
                {ADVANCED_OPTIONS_SCHEMA.map((option) => (
                  <Flex key={option.key} justify="space-between" align="center">
                    <Box>
                      <Text fontSize="sm" fontWeight="medium">
                        {option.label}
                      </Text>
                      <Text fontSize="xs" className="pill-box-icons">
                        {option.description}
                      </Text>
                    </Box>
                    <Switch
                      size="sm"
                      isChecked={
                        userSettings.advanced_options?.[option.key] ??
                        option.defaultValue
                      }
                      onChange={(e) =>
                        handleAdvancedOptionChange(option.key, e.target.checked)
                      }
                    />
                  </Flex>
                ))}
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Collapse>
    </Box>
  );
};

export default UserSettingsPanel;
