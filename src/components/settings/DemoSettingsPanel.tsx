// Demo settings: local model presets, doctor identity, storage, reset.
import { useEffect, useState } from "react";

import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Input,
  NativeSelect,
  Field,
  Progress,
  Tabs,
} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { GreenButton, GreyButton } from "../common/Buttons";
import {
  FaCheck,
  FaDownload,
  FaFileExport,
  FaMicrochip,
  FaSave,
  FaSlidersH,
  FaTrash,
  FaUser,
  FaDatabase,
} from "react-icons/fa";
import { settingsApi } from "../../utils/api/settingsApi";
import { SPECIALTIES } from "../../utils/constants";
import {
  LLM_PRESETS,
  CUSTOM_LLM_PRESET,
  ensureModel,
  invalidateModel,
  onStatus,
  type LlmStatus,
} from "../../localBackend/llm";
import { ASR_PRESETS } from "../../localBackend/asr";
import {
  getAsrModelId,
  getModelId,
  setAsrModelId,
  setModelId,
  resetDemoData,
  buildDemoExport,
  storageUsageBytes,
} from "../../localBackend/db";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DemoSettingsPanel = () => {
  const [llmStatus, setLlmStatus] = useState<LlmStatus>({ state: "idle" });
  const [selectedPreset, setSelectedPreset] = useState<string>(
    LLM_PRESETS.some((preset) => preset.id === getModelId())
      ? (getModelId() as string)
      : CUSTOM_LLM_PRESET,
  );
  const [customRepo, setCustomRepo] = useState<string>(
    LLM_PRESETS.some((preset) => preset.id === getModelId()) ? "" : getModelId(),
  );
  const [asrModel, setAsrModel] = useState<string>(getAsrModelId());
  const [doctorName, setDoctorName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => onStatus(setLlmStatus), []);

  useEffect(() => {
    settingsApi
      .fetchUserSettings()
      .then((settings) => {
        setDoctorName((settings?.name as string) ?? "");
        setSpecialty((settings?.specialty as string) ?? "");
      })
      .catch(() => {});
  }, []);

  const applyLlmModel = (modelId: string) => {
    setModelId(modelId);
    invalidateModel();
  };

  const handlePresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedPreset(value);
    if (value !== CUSTOM_LLM_PRESET) {
      applyLlmModel(value);
    }
  };

  const handleCustomRepoApply = () => {
    const repoId = customRepo.trim();
    if (!repoId) {
      toaster.create({
        title: "Custom model",
        description: "Enter a Hugging Face repo id first",
        duration: 3000,
      });
      return;
    }
    applyLlmModel(repoId);
  };

  const handleLoadModel = async () => {
    try {
      await ensureModel();
      toaster.create({
        title: "Model ready",
        description: "Local model loaded and cached by the browser",
        type: "success",
        duration: 3000,
      });
    } catch (error) {
      toaster.create({
        title: "Model failed to load",
        description: String(error),
        type: "error",
        duration: 8000,
      });
    }
  };

  const handleAsrChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setAsrModel(value);
    setAsrModelId(value);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await settingsApi.saveUserSettings({ name: doctorName, specialty });
      toaster.create({
        title: "Saved",
        description: "Doctor details updated — they shape the letter voice",
        type: "success",
        duration: 3000,
      });
    } catch {
      toaster.create({
        title: "Error",
        description: "Failed to save doctor details",
        type: "error",
        duration: 5000,
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleClearAllData = async () => {
    resetDemoData();
    // Also purge cached models (transformers.js Cache API entries) so "clear"
    // means a genuinely fresh start.
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    window.location.reload();
  };

  const handleExportData = () => {
    const payload = JSON.stringify(buildDemoExport(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `phlox-demo-export-${stamp}.json`;
    document.body.appendChild(anchor);
    URL.revokeObjectURL(url);
  };

  const loading = llmStatus.state === "loading";

  return (
    <Box className="panels-bg" p="4" borderRadius="sm" w="100%">
      <Flex align="center" mb="1">
        <FaSlidersH size="1.2em" style={{ marginRight: "5px" }} />
        <Text as="h3">Demo Settings</Text>
      </Flex>
      <Tabs.Root variant="enclosed" mt={4} defaultValue="0">
        <Tabs.List>
          <Tabs.Trigger className="tab-style" value="0">
            <HStack>
              <FaMicrochip />
              <Text>Local Models</Text>
            </HStack>
          </Tabs.Trigger>
          <Tabs.Trigger className="tab-style" value="1">
            <HStack>
              <FaUser />
              <Text>Doctor Details</Text>
            </HStack>
          </Tabs.Trigger>
          <Tabs.Trigger className="tab-style" value="2">
            <HStack>
              <FaDatabase />
              <Text>Demo Data</Text>
            </HStack>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="0" className="floating-main">
          <VStack gap={4} align="stretch">
            <Field.Root>
              <Field.Label fontSize="sm" color="textSecondary">
                Letter / Summary Model (Qwen3.5)
              </Field.Label>
              <NativeSelect.Root>
                <NativeSelect.Field
                  className="input-style"
                  value={selectedPreset}
                  onChange={handlePresetChange}
                >
                  {LLM_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                  <option value={CUSTOM_LLM_PRESET}>Custom…</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>

            {selectedPreset === CUSTOM_LLM_PRESET && (
              <HStack gap={2}>
                <Input
                  className="input-style"
                  size="sm"
                  placeholder="HF repo id, e.g. onnx-community/Qwen3.5-0.8B-ONNX-OPT"
                  value={customRepo}
                  onChange={(event) => setCustomRepo(event.target.value)}
                />
                <GreyButton onClick={handleCustomRepoApply} mr={2} leftIcon={<FaCheck />}>
                  Apply
                </GreyButton>
              </HStack>
            )}

            <Field.Root>
              <Field.Label fontSize="sm" color="textSecondary">
                Transcription Model (Whisper)
              </Field.Label>
              <NativeSelect.Root>
                <NativeSelect.Field
                  className="input-style"
                  value={asrModel}
                  onChange={handleAsrChange}
                >
                  {ASR_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>

            <HStack gap={3} align="center">
              <GreenButton onClick={handleLoadModel} loading={loading} loadingText="Loading" leftIcon={<FaDownload />}>
                Load Model
              </GreenButton>
              <Text fontSize="sm" color="textSecondary">
                {llmStatus.state === "idle" && "Model: not loaded"}
                {loading &&
                  (llmStatus.progress !== undefined
                    ? `Downloading ${llmStatus.progress}%`
                    : "Preparing…")}
                {llmStatus.state === "ready" &&
                  `Ready (${llmStatus.device})${llmStatus.modelId ? ` · ${llmStatus.modelId}` : ""}`}
                {llmStatus.state === "error" && `Error: ${llmStatus.error ?? "load failed"}`}
              </Text>
            </HStack>

            {loading && llmStatus.progress !== undefined && (
              <Progress.Root value={llmStatus.progress} colorPalette="blue" size="sm" striped animated>
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
            )}

            <Text fontSize="xs" color="textSecondary">
              First load downloads the model from the Hugging Face CDN (2B preset
              ≈ 2 GB); the browser caches it for later sessions. Whisper (~80 MB)
              downloads on first use with toast progress.
            </Text>
          </VStack>
        </Tabs.Content>

        <Tabs.Content value="1" className="floating-main">
          <VStack gap={4} align="stretch">
            <Field.Root>
              <Field.Label fontSize="sm" color="textSecondary">
                Name
              </Field.Label>
              <Input
                className="input-style"
                size="sm"
                placeholder="Dr Jane Smith"
                value={doctorName}
                onChange={(event) => setDoctorName(event.target.value)}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label fontSize="sm" color="textSecondary">
                Specialty
              </Field.Label>
              <NativeSelect.Root>
                <NativeSelect.Field
                  className="input-style"
                  value={specialty}
                  onChange={(event) => setSpecialty(event.target.value)}
                >
                  <option value="">Select specialty…</option>
                  {SPECIALTIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <GreyButton
              onClick={handleSaveProfile}
              loading={savingProfile}
              loadingText="Saving"
              width="150px"
              leftIcon={<FaSave />}
            >
              Save Details
            </GreyButton>
            <Text fontSize="xs" color="textSecondary">
              Letters are written in this voice — regenerate a letter to see the
              signature change.
            </Text>
          </VStack>
        </Tabs.Content>

        <Tabs.Content value="2" className="floating-main">
          <VStack gap={3} align="stretch">
            <Text fontSize="sm" color="textSecondary">
              Storage used: {formatBytes(storageUsageBytes())} (patients,
              letters, settings — all in localStorage)
            </Text>
            <HStack gap={3}>
              <GreyButton onClick={handleExportData} width="200px" leftIcon={<FaFileExport />}>
                Export Data
              </GreyButton>
              <GreyButton onClick={handleClearAllData} width="200px" leftIcon={<FaTrash />}>
                Clear All Data
              </GreyButton>
            </HStack>
            <Text fontSize="xs" color="textSecondary">
              Export downloads all patients, encounters, letters, transcripts and
              jobs as JSON (format "phlox-demo-export" v1) — shaped to import
              into a full Phlox instance later.
            </Text>
            <Text fontSize="xs" color="textSecondary">
              Clearing removes every patient, letter and setting, purges the
              browser&rsquo;s cached models (next load re-downloads them), and
              reloads the app.
            </Text>
          </VStack>
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
};

export default DemoSettingsPanel;
