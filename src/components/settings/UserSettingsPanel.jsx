// Component for configuring user-specific settings.
import { Box, Flex, HStack, IconButton, Text, Collapsible, Input, NativeSelect, Tabs, VStack, Field } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRightIcon, ChevronDownIcon } from "../common/icons";
import { FaUser, FaFileAlt, FaEnvelopeOpenText, FaComments } from "react-icons/fa";
import TemplateSettingsPanel from "./TemplateSettingsPanel";
import LetterTemplatesPanel from "./LetterTemplatesPanel";
import ChatSettingsPanel from "./ChatSettingsPanel";
import { isChatEnabled } from "../../utils/helpers/featureFlags";
import { settingsApi } from "../../utils/api/settingsApi";
import { syncLanguage } from "../../i18n";
import { PREFERRED_LANGUAGE_OPTIONS, getLanguageName } from "../../utils/i18n/languages";

const UserSettingsPanel = ({
  isCollapsed,
  setIsCollapsed,
  userSettings,
  setUserSettings,
  specialties,
  templates,
  letterTemplates,
  setTemplates,
}) => {
  const { t } = useTranslation();
  const [capabilities, setCapabilities] = useState(null);

  // Capabilities tell us whether the active STT model supports the selected
  // language (local mode). Remote mode returns ["*"] (unrestricted).
  useEffect(() => {
    let cancelled = false;
    settingsApi
      .fetchCapabilities()
      .then((caps) => {
        if (!cancelled) setCapabilities(caps);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const sttLanguages = capabilities?.stt_languages || ["*"];
  const isRemoteSTT = sttLanguages.includes("*");
  const selectedLanguage = userSettings.preferred_language || "en";
  const languageSupported =
    isRemoteSTT || sttLanguages.includes(selectedLanguage);

  const handleLanguageChange = (lang) => {
    setUserSettings((prev) => ({ ...prev, preferred_language: lang }));
    // Apply immediately so locale-aware formatting tracks the clinic language.
    syncLanguage(lang);
  };

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
          <Tabs.Root variant='enclosed' mt={4} defaultValue="0">
            <Tabs.List>
              <Tabs.Trigger className="tab-style" value="0">
                <HStack>
                  <FaUser />
                  <Text>General</Text>
                </HStack>
              </Tabs.Trigger>
              <Tabs.Trigger className="tab-style" value="2">
                <HStack>
                  <FaFileAlt />
                  <Text>Note Templates</Text>
                </HStack>
              </Tabs.Trigger>
              <Tabs.Trigger className="tab-style" value="3">
                <HStack>
                  <FaEnvelopeOpenText />
                  <Text>Letter Templates</Text>
                </HStack>
              </Tabs.Trigger>
              {isChatEnabled() && (
                <Tabs.Trigger className="tab-style" value="4">
                  <HStack>
                    <FaComments />
                    <Text>Quick Chat</Text>
                  </HStack>
                </Tabs.Trigger>
              )}
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
                      {t("language.label")}
                    </Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        size="sm"
                        value={selectedLanguage}
                        onChange={(e) => handleLanguageChange(e.target.value)}
                        className="input-style">
                        {PREFERRED_LANGUAGE_OPTIONS.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.native} ({lang.name})
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                    <Text fontSize="xs" className="pill-box-icons" mt={1}>
                      {t("language.description")}
                    </Text>
                    {!languageSupported && (
                      <Text fontSize="xs" mt={1}>
                        {t("language.transcriptionUnsupported", {
                          language: getLanguageName(selectedLanguage),
                        })}
                      </Text>
                    )}
                  </Field.Root>
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

              <Tabs.Content value="2" className="floating-main">
                <TemplateSettingsPanel
                  templates={templates}
                  setTemplates={setTemplates}
                />
              </Tabs.Content>
              <Tabs.Content value="3" className="floating-main">
                <LetterTemplatesPanel />
              </Tabs.Content>
              {isChatEnabled() && (
                <Tabs.Content value="4" className="floating-main">
                  <ChatSettingsPanel
                    userSettings={userSettings}
                    setUserSettings={setUserSettings}
                  />
                </Tabs.Content>
              )}
          </Tabs.Root>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};

export default UserSettingsPanel;
