import {
  VStack,
  HStack,
  Text,
  Input,
  NativeSelect,
  Field,
  Spinner,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/components/ui/tooltip";
import { InfoIcon } from "../../icons";

export const RemoteModeForm = ({
  llmBaseUrl,
  setLlmBaseUrl,
  llmApiKey,
  setLlmApiKey,
  primaryModel,
  setPrimaryModel,
  availableModels,
  isFetchingLLMModels,
  whisperBaseUrl,
  setWhisperBaseUrl,
  whisperModel,
  setWhisperModel,
  availableWhisperModels,
  whisperModelListAvailable,
  isFetchingWhisperModels,
}) => {
  const { t } = useTranslation();

  return (
    <VStack
      gap={3}
      w="100%"
      className="anim-fade-slide-up"
      sx={{ animationDuration: "0.25s" }}
    >
      <Field.Root>
        <HStack>
          <Field.Label fontSize="sm" color="textSecondary">
            {t("splash.remote.apiUrl")}
          </Field.Label>
          <Tooltip
            content={t("splash.remote.apiUrlTooltip")}
            showArrow
          >
            <InfoIcon boxSize={3} color="textSecondary" />
          </Tooltip>
        </HStack>
        <Input
          placeholder="http://localhost:11434"
          value={llmBaseUrl}
          onChange={(e) => setLlmBaseUrl(e.target.value)}
          className="input-style"
          size="sm"
        />
      </Field.Root>

      <Field.Root>
        <HStack>
          <Field.Label fontSize="sm" color="textSecondary">
            {t("splash.remote.apiKey")}
          </Field.Label>
          <Tooltip
            content={t("splash.remote.apiKeyTooltip")}
            showArrow
          >
            <InfoIcon boxSize={3} color="textSecondary" />
          </Tooltip>
        </HStack>
        <Input
          type="password"
          placeholder="sk-..."
          value={llmApiKey}
          onChange={(e) => setLlmApiKey(e.target.value)}
          className="input-style"
          size="sm"
        />
      </Field.Root>

      <Field.Root required={availableModels.length > 0}>
        <HStack>
          <Field.Label fontSize="sm" color="textSecondary">
            {t("splash.remote.primaryModel")}
          </Field.Label>
          <Tooltip
            content={t("splash.remote.primaryModelTooltip")}
            showArrow
          >
            <InfoIcon boxSize={3} color="textSecondary" />
          </Tooltip>
        </HStack>
        <NativeSelect.Root>
          <NativeSelect.Field
            placeholder={
              availableModels.length === 0 && !isFetchingLLMModels
                ? t("splash.remote.noModelsFound")
                : t("splash.remote.selectModel")
            }
            value={primaryModel}
            onChange={(e) => setPrimaryModel(e.target.value)}
            disabled={isFetchingLLMModels || availableModels.length === 0}
            className="input-style"
            size="sm"
          >
            {availableModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        {isFetchingLLMModels && (
          <HStack gap={2} mt={2}>
            <Spinner size="xs" color="primaryButton" />
            <Text fontSize="sm" color="textSecondary">
              {t("splash.remote.loadingModels")}
            </Text>
          </HStack>
        )}
      </Field.Root>

      {/* Transcription settings — always visible */}
      <VStack gap={2} w="100%" align="stretch">
        <Text fontSize="xs" fontWeight="bold" className="pill-box-icons">
          {t("splash.step.aiModels.transcription")}
        </Text>
        <Field.Root>
          <Field.Label fontSize="sm" color="textSecondary">
            {t("splash.remote.whisperUrl")}
          </Field.Label>
          <Input
            placeholder="http://localhost:8080"
            value={whisperBaseUrl}
            onChange={(e) => setWhisperBaseUrl(e.target.value)}
            className="input-style"
            size="sm"
          />
        </Field.Root>
        {whisperBaseUrl.trim() && (
          <Field.Root>
            <Field.Label fontSize="sm" color="textSecondary">
              {t("splash.remote.whisperModel")}
            </Field.Label>
            {whisperModelListAvailable &&
            availableWhisperModels.length > 0 ? (
              <NativeSelect.Root>
                <NativeSelect.Field
                  placeholder={t("splash.remote.selectModel")}
                  value={whisperModel}
                  onChange={(e) => setWhisperModel(e.target.value)}
                  disabled={isFetchingWhisperModels}
                  className="input-style"
                  size="sm"
                >
                  {availableWhisperModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            ) : (
              <Input
                placeholder={t("splash.remote.whisperModelPlaceholder")}
                value={whisperModel}
                onChange={(e) => setWhisperModel(e.target.value)}
                disabled={isFetchingWhisperModels}
                className="input-style"
                size="sm"
              />
            )}
            {isFetchingWhisperModels && (
              <HStack gap={2} mt={2}>
                <Spinner size="xs" color="primaryButton" />
                <Text fontSize="sm" color="textSecondary">
                  {t("splash.remote.loading")}
                </Text>
              </HStack>
            )}
          </Field.Root>
        )}
      </VStack>
    </VStack>
  );
};
