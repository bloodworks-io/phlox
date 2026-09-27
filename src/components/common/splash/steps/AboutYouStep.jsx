import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { VStack, HStack, Input, NativeSelect, Field } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { InfoIcon } from "../../icons";
import { SPECIALTIES } from "../../../../utils/constants";
import { validatePersonalStep } from "../../../../utils/splash/validators";
import { UI_LANGUAGES } from "../../../../utils/i18n/languages";
import { syncLanguage } from "../../../../i18n";

export const usePersonalStep = () => {
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [language, setLanguageState] = useState("en");

  const setLanguage = useCallback((lang) => {
    setLanguageState(lang);
    syncLanguage(lang);
  }, []);

  return {
    name,
    setName,
    specialty,
    setSpecialty,
    language,
    setLanguage,
    validate: () => validatePersonalStep(name, specialty),
    getData: () => ({ name, specialty, preferred_language: language }),
  };
};

export const AboutYouStep = ({
  name,
  setName,
  specialty,
  setSpecialty,
  language,
  setLanguage,
  letters,
}) => {
  const { t } = useTranslation();

  return (
  <VStack key="about-you" className="anim-fade-slide-right" gap={4} w="100%">
    <Field.Root required>
      <HStack>
        <Field.Label fontSize="sm" color="textSecondary">{t("splash.step.aboutYou.nameLabel")}</Field.Label>
        <Tooltip content={t("splash.step.aboutYou.nameTooltip")} showArrow>
          <InfoIcon boxSize={3} color="textSecondary" />
        </Tooltip>
      </HStack>
      <Input
        placeholder={t("splash.step.aboutYou.namePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input-style"
        size="sm"
      />
    </Field.Root>

    <Field.Root required>
      <HStack>
        <Field.Label fontSize="sm" color="textSecondary">{t("splash.step.aboutYou.specialtyLabel")}</Field.Label>
        <Tooltip content={t("splash.step.aboutYou.specialtyTooltip")} showArrow>
          <InfoIcon boxSize={3} color="textSecondary" />
        </Tooltip>
      </HStack>
      <NativeSelect.Root>
        <NativeSelect.Field
          placeholder={t("splash.step.aboutYou.specialtyPlaceholder")}
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          className="input-style"
          size="sm"
        >
          {SPECIALTIES.map((spec) => (
            <option key={spec} value={spec}>
              {t(`specialty.${spec.toLowerCase().replace(/ /g, "_")}`)}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Field.Root>

    <Field.Root>
      <HStack>
        <Field.Label fontSize="sm" color="textSecondary">{t("splash.step.aboutYou.languageLabel")}</Field.Label>
        <Tooltip content={t("splash.step.aboutYou.languageTooltip")} showArrow>
          <InfoIcon boxSize={3} color="textSecondary" />
        </Tooltip>
      </HStack>
      <NativeSelect.Root>
        <NativeSelect.Field
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="input-style"
          size="sm"
        >
          {UI_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.native} ({lang.name})
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Field.Root>

    {/* Letter template — optional */}
    {letters && letters.availableLetterTemplates.length > 0 && (
      <Field.Root>
        <HStack>
          <Field.Label fontSize="sm" color="textSecondary">{t("splash.step.aboutYou.letterTemplateLabel")}</Field.Label>
          <Tooltip content={t("splash.step.aboutYou.letterTemplateTooltip")} showArrow>
            <InfoIcon boxSize={3} color="textSecondary" />
          </Tooltip>
        </HStack>
        <NativeSelect.Root>
          <NativeSelect.Field
            placeholder={t("splash.step.aboutYou.letterTemplatePlaceholder")}
            value={letters.selectedLetterTemplate}
            onChange={(e) => letters.setSelectedLetterTemplate(e.target.value)}
            className="input-style"
            size="sm"
          >
            {letters.availableLetterTemplates.map((t) => (
              <option key={t.id} value={t.id.toString()}>{t.name}</option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Field.Root>
    )}
  </VStack>
  );
};
