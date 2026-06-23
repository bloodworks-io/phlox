// Component for configuring user-specific settings.
import { Steps, Box, Flex, HStack, IconButton, Text, Collapsible, Input, NativeSelect, Switch, Tabs, VStack, Field } from "@chakra-ui/react";
import { ChevronRightIcon, ChevronDownIcon } from "../common/icons";
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
  {
    key: "require_scribe_consent",
    label: "Require patient consent for ambient scribing",
    description:
      "Prompt each patient for consent before ambient (transcription) recording. Dictation is unaffected; consent is remembered per patient.",
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
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label="Toggle collapse"
            variant="outline"
            size="sm"
            mr="2"
            className="collapse-toggle">{isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}</IconButton>
          <FaUser size="1.2em" style={{ marginRight: "5px" }} />
          <Text as="h3">User Settings</Text>
        </Flex>
      </Flex>
      <Collapsible.Root open={!isCollapsed}>
        <Collapsible.Content>
          <Tabs.Root variant='enclosed' mt={4}>
            <Tabs.List>
              <Tabs.Trigger className="tab-style" value="0">
                <HStack>
                  <FaUser />
                  <Text>General</Text>
                </HStack>
              </Tabs.Trigger>
              <Tabs.Trigger className="tab-style" value="1">
                <HStack>
                  <FaCog />
                  <Text>Advanced</Text>
                </HStack>
              </Tabs.Trigger>
            </Tabs.List>
            
              <Tabs.Content value="0" className="floating-main">
                <VStack gap={4} align="stretch">
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
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        size="sm"
                        value={userSettings.specialty || ""}
                        onChange={(e) =>
                          setUserSettings((prev) => ({
                            ...prev,
                            specialty: e.target.value,
                          }))
                        }
                        className="input-style"
                        placeholder="Select your specialty">
                        {specialties.map((specialty) => (
                          <option key={specialty} value={specialty}>
                            {specialty}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Box>
                  <Field.Root>
                    <Field.Label fontSize="sm" fontWeight={"bold"}>
                      Default Template
                    </Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        size="sm"
                        value={userSettings.default_template || ""}
                        onChange={(e) => handleDefaultTemplateChange(e.target.value)}
                        className="input-style"
                        placeholder="Select default template">
                        {/* Change this part to map over templates array correctly */}
                        {templates.map((template) => (
                          <option
                            key={template.template_key}
                            value={template.template_key}
                          >
                            {template.template_name}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>
                  <Field.Root>
                    <Field.Label fontSize="sm" fontWeight={"bold"}>
                      Default Letter Template
                    </Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        size="sm"
                        value={userSettings.default_letter_template_id || ""}
                        onChange={(e) =>
                          handleDefaultLetterTemplateChange(e.target.value)
                        }
                        className="input-style"
                        placeholder="Select default letter template">
                        {letterTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>
                </VStack>
              </Tabs.Content>
              <Tabs.Content value="1" className="floating-main">
                <Text fontSize="sm" mb={4} className="pill-box-icons">
                  These options are intended for advanced users. Changing them may
                  affect storage or performance.
                </Text>
                <VStack gap={3} align="stretch">
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
                      <Switch.Root
                        size="sm"
                        checked={
                          userSettings.advanced_options?.[option.key] ??
                          option.defaultValue
                        }
                        onCheckedChange={({ checked }) =>
                          handleAdvancedOptionChange(option.key, checked)
                        }
                      >
                        <Switch.HiddenInput />
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Root>
                    </Flex>
                  ))}
                </VStack>
              </Tabs.Content>
            
          </Tabs.Root>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};

export default UserSettingsPanel;
