import {
  VStack,
  HStack,
  Text,
  Input,
  NativeSelect,
  Field,
  Spinner,
} from "@chakra-ui/react";
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
  return (
    <VStack gap={3} w="100%">
      <Field.Root>
        <HStack>
          <Field.Label fontSize="sm" color="textSecondary">
            API URL
          </Field.Label>
          <Tooltip
            content="OpenAI/Ollama-compatible endpoint (usually http://localhost:11434 for local Ollama)"
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
            API Key
          </Field.Label>
          <Tooltip
            content="API key for authenticating with the service. Leave empty for local servers like Ollama."
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
            Primary Model
          </Field.Label>
          <Tooltip
            content="The main AI model for medical queries. We recommend llama3.1:8b or gpt-4."
            showArrow
          >
            <InfoIcon boxSize={3} color="textSecondary" />
          </Tooltip>
        </HStack>
        <NativeSelect.Root>
          <NativeSelect.Field
            placeholder={
              availableModels.length === 0 && !isFetchingLLMModels
                ? "No models found — check URL"
                : "Select model"
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
              Loading models...
            </Text>
          </HStack>
        )}
      </Field.Root>

      {/* Transcription settings — always visible */}
      <VStack gap={2} w="100%" align="stretch">
        <Text fontSize="xs" fontWeight="bold" className="pill-box-icons">
          Transcription
        </Text>
        <Field.Root>
          <Field.Label fontSize="sm" color="textSecondary">
            Whisper URL
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
              Whisper Model
            </Field.Label>
            {whisperModelListAvailable &&
            availableWhisperModels.length > 0 ? (
              <NativeSelect.Root>
                <NativeSelect.Field
                  placeholder="Select model"
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
                placeholder="e.g., whisper-1, base, small"
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
                  Loading...
                </Text>
              </HStack>
            )}
          </Field.Root>
        )}
      </VStack>
    </VStack>
  );
};
