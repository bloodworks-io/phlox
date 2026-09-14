// Getting-started card: probes the device (WebGPU tier + adapter label),
// sets performance expectations, and owns the one-click model download.
import { useEffect, useState } from "react";
import { Flex, Text, Button, VStack } from "@chakra-ui/react";
import { FaDownload } from "react-icons/fa";
import { QuestionIcon } from "./icons";
import { describeGpu, ensureModel, isModelReady, onStatus } from "../../localBackend/llm";
import { ensureAsr } from "../../localBackend/asr";
import { toaster } from "@/components/ui/toaster";

const downloadModels = async () => {
  try {
    await ensureModel();
    await ensureAsr();
    toaster.create({
      title: "Models ready",
      description: "Letter generation, scribe and document extraction are good to go",
      type: "success",
      duration: 4000,
    });
  } catch (error) {
    toaster.create({
      title: "Model download failed",
      description: String(error),
      type: "error",
      duration: 8000,
    });
  }
};

const deviceCopy = (gpu) => {
  if (gpu === null) return "Checking this machine's graphics support…";
  if (gpu.tier === "webgpu") {
    return `Detected: ${gpu.label ?? "WebGPU-capable GPU"} · WebGPU ✓`;
  }
  if (gpu.label) {
    return `Detected: ${gpu.label}, but it lacks what the models need (float16 shaders) — running on CPU`;
  }
  return "No usable WebGPU found — models will run on the CPU";
};

const expectationCopy = (gpu) => {
  if (gpu === null) return "";
  if (gpu.tier === "webgpu") {
    return "Expect roughly 30–60 seconds per generated letter, and about a minute of transcription plus extraction for a two-minute recording.";
  }
  return "Everything works, but expect several minutes per letter and slow transcription. A Chrome-based browser with WebGPU (most Macs and recent Windows laptops) is much faster.";
};

const OnboardingCard = () => {
  const [gpu, setGpu] = useState(null);
  const [modelStatus, setModelStatus] = useState({ state: "idle" });

  useEffect(() => onStatus(setModelStatus), [setModelStatus]);

  useEffect(() => {
    let cancelled = false;
    describeGpu().then((description) => {
      if (!cancelled) setGpu(description);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <VStack className="panels-bg" borderRadius="lg" p={4} gap={2} align="stretch">
      <Text fontSize="md" fontWeight="bold">
        Getting started
      </Text>
      <Text fontSize="sm" color="overlay0">
        {deviceCopy(gpu)}
      </Text>
      {gpu && (
        <Text fontSize="sm" color="overlay0">
          <QuestionIcon /> {expectationCopy(gpu)}
        </Text>
      )}
      <Text fontSize="sm" color="overlay0">
        Model weights (a few hundred MB) download from the Hugging Face CDN on
        first use and are cached by your browser. Pick different presets in
        Settings.
      </Text>
      <Flex justify="flex-end">
        <Button
          onClick={downloadModels}
          disabled={modelStatus.state === "loading" || isModelReady()}
          className="dashboard-chat-suggestions"
          size="sm"
        >
          <FaDownload />
          {modelStatus.state === "loading"
            ? `Downloading ${modelStatus.progress ?? 0}%`
            : isModelReady()
              ? "Models ready ✓"
              : "Download models"}
        </Button>
      </Flex>
    </VStack>
  );
};

export default OnboardingCard;
