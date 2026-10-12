// Getting-started card: the local-first story front and centre — what runs
// where (this machine, its GPU), what the one-time download costs — plus the
// device probe and the one-click model download.
import { useEffect, useState } from "react";
import { Box, Flex, Text, Button, VStack } from "@chakra-ui/react";
import { FaDownload, FaLaptop, FaLock, FaMicrochip } from "react-icons/fa";
import { toaster } from "@/components/ui/toaster";
import { describeGpu, isModelReady, onStatus, warmModel } from "../../localBackend/llm";
import { getModelId } from "../../localBackend/db";
import { warmAsr } from "../../localBackend/asr";

const downloadModels = async () => {
  try {
    // Engine-aware: warms WebLLM/parakeet when those presets are active,
    // the transformers.js engines otherwise.
    await warmModel();
    await warmAsr();
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
    return `Detected: ${gpu.label ?? "a WebGPU-capable GPU"} · WebGPU ✓`;
  }
  if (gpu.label) {
    return `Detected: ${gpu.label}, but it lacks what the models need (float16 shaders). Running on CPU.`;
  }
  return "No usable WebGPU found. Models will run on the CPU.";
};

const expectationCopy = (gpu) => {
  if (gpu === null) return "";
  if (gpu.tier === "webgpu") {
    // Measured on Apple silicon (M3, engine warm): 0.8B ≈ 5–6s per
    // extraction, 2B ≈ 10s; transcription runs live at 20–35× real time.
    return "Letters generate in roughly five to ten seconds, and transcription runs live while you record. Speeds vary by GPU.";
  }
  return "Everything works, but expect several minutes per letter and slow transcription. A Chrome-based browser with WebGPU (most Macs and recent Windows laptops) is much faster.";
};

const Chip = ({ icon: Icon, title, hint }) => (
    <Flex
        direction="column"
        align="center"
        textAlign="center"
        gap={1.5}
        px={3}
        py={3}
        flex="1 1 140px"
        borderRadius="lg"
        bg="surfaceQuartile"
    >
        <Flex
            align="center"
            justify="center"
            w="30px"
            h="30px"
            borderRadius="full"
            bg="surface"
            color="accent"
            flexShrink={0}
        >
            <Icon size={13} />
        </Flex>
        <Text fontSize="xs" fontWeight="700" color="textPrimary">
            {title}
        </Text>
        <Text fontSize="10px" color="textTertiary" lineHeight="1.3">
            {hint}
        </Text>
    </Flex>
);

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

  const ready = isModelReady();
  const loading = modelStatus.state === "loading";

  return (
    <VStack className="panels-bg" borderRadius="lg" p={5} gap={4} align="stretch">
      <Flex gap={3} align="center">
        <Flex
            align="center"
            justify="center"
            w="38px"
            h="38px"
            borderRadius="full"
            bg="surfaceQuartile"
            color="accent"
            flexShrink={0}
        >
            <FaLaptop size={16} />
        </Flex>
        <Box>
          <Text fontSize="md" fontWeight="bold">
            Everything runs on this machine
          </Text>
          <Text fontSize="sm" color="textSecondary">
            Phlox Web is the browser edition of the desktop scribe. It downloads
            its AI models into your browser and runs them on this computer. No
            account, no server.
          </Text>
        </Box>
      </Flex>

      <Flex className="anim-stagger" wrap="wrap" gap={2.5}>
        <Chip icon={FaMicrochip} title="Local GPU" hint="models run in your browser via WebGPU" />
        <Chip icon={FaLock} title="Fully private" hint="audio, notes and letters never leave this device" />
        <Chip
            icon={FaDownload}
            title={`One-time ${getModelId() === "phlox-2b" ? "~1.1GB" : "~450MB"}`}
            hint="cached by your browser for next visits"
        />
      </Flex>

      <Box borderTopWidth="1px" borderColor="surface" pt={3}>
        <Flex gap={2} align="center" wrap="wrap">
          <Box
            w="8px"
            h="8px"
            borderRadius="full"
            bg={gpu?.tier === "webgpu" ? "accent" : "warning"}
            flexShrink={0}
          />
          <Text fontSize="sm" color="textSecondary" flex="1">
            {deviceCopy(gpu)}
          </Text>
        </Flex>
        {gpu && (
          <Text fontSize="xs" color="overlay0" mt={1.5}>
            {expectationCopy(gpu)}
          </Text>
        )}
      </Box>

      <Flex justify="space-between" align="center" gap={3} wrap="wrap">
        <Text fontSize="xs" color="overlay0">
          {ready
            ? "Models are ready. Pick sizes in Settings."
            : "Download the models to get started. Pick sizes in Settings."}
        </Text>
        <Button
          onClick={downloadModels}
          disabled={loading || ready}
          className="dashboard-chat-suggestions"
          size="sm"
        >
          <FaDownload />
          {loading
            ? `Downloading ${modelStatus.progress ?? 0}%`
            : ready
              ? "Models ready ✓"
              : "Download models"}
        </Button>
      </Flex>
    </VStack>
  );
};

export default OnboardingCard;
