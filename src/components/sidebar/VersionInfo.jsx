import React, { useEffect, useState } from "react";
import { Box, VStack, HStack, Center, Badge, Text } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { FaMoon, FaSun, FaGithub } from "react-icons/fa";
import { BsCheck2All, BsExclamationTriangle } from "react-icons/bs";
import { useNavigate } from "react-router";
import { onStatus } from "../../localBackend/llm";

const GITHUB_URL = "https://github.com/bloodworks-io/phlox";

const GitHubLink = ({ isCollapsed }) => (
  <Tooltip content="View on GitHub" positioning={{ placement: isCollapsed ? "right" : "top" }}>
    <Box
      as="a"
      href={GITHUB_URL}
      target="_blank"
      rel="noreferrer"
      cursor="pointer"
      fontSize={isCollapsed ? "md" : "lg"}
      color="sidebar.text"
      _hover={{ color: "sidebar.text" }}
    >
      <FaGithub />
    </Box>
  </Tooltip>
);

const ThemeToggle = ({ colorMode, toggleColorMode, isCollapsed }) => (
  <Tooltip
    content={colorMode === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
    positioning={{ placement: isCollapsed ? "right" : "top" }}
  >
    <Box
      onClick={toggleColorMode}
      cursor="pointer"
      fontSize={isCollapsed ? "md" : "lg"}
      color="sidebar.text"
      _hover={{ color: "sidebar.text" }}
    >
      {colorMode === "light" ? <FaMoon /> : <FaSun />}
    </Box>
  </Tooltip>
);

// Full-fat StatusIcon treatment (subtle pill + BsCheck2All/BsExclamationTriangle),
// sidebar-bg fill and border, grey bold label text.
const STATUS_ICON_COLOR = {
  idle: "gray.400",
  loading: "orange.400",
  ready: "green.400",
  error: "red.400",
};

function statusLabel(status) {
  if (status.state === "loading") {
    return status.progress !== undefined ? `Downloading model ${status.progress}%` : "Loading model…";
  }
  if (status.state === "ready") return `Model ready (${status.device ?? "wasm"})`;
  if (status.state === "error") return "Model error — check Settings";
  return "Model not loaded";
}

function statusWord(status) {
  if (status.state === "loading") return status.progress !== undefined ? `${status.progress}%` : "…";
  if (status.state === "ready") return "Ready";
  if (status.state === "error") return "Error";
  return "Off";
}

const ModelStatus = ({ isCollapsed }) => {
  const [status, setStatus] = useState({ state: "idle" });
  const navigate = useNavigate();

  useEffect(() => onStatus(setStatus), [setStatus]);

  const well = status.state === "ready";

  return (
    <Tooltip content={`${statusLabel(status)} — click to open Settings`} positioning={{ placement: isCollapsed ? "right" : "top" }}>
      <Badge
        borderRadius="full"
        p={1}
        cursor="pointer"
        onClick={() => navigate("/settings")}
        bg="rgba(45, 47, 65, 0.95)"
        border="1px solid"
        borderColor="whiteAlpha.200"
        display="inline-flex"
        alignItems="center"
        gap={1}
      >
        <Box as="span" color={STATUS_ICON_COLOR[status.state] ?? "gray.400"} display="inline-flex">
          {well ? <BsCheck2All /> : <BsExclamationTriangle />}
        </Box>
        {!isCollapsed && (
          <Text fontSize="2xs" fontWeight="bold" color="sidebar.text" whiteSpace="nowrap">
            {statusWord(status)}
          </Text>
        )}
      </Badge>
    </Tooltip>
  );
};

const VersionInfo = ({ isCollapsed, colorMode, toggleColorMode }) => {
  if (isCollapsed) {
    return (
      <Box position="relative" width="100%">
        <VStack gap={2} align="center" width="100%">
          <ModelStatus isCollapsed={isCollapsed} />
          <GitHubLink isCollapsed={isCollapsed} />
          <ThemeToggle colorMode={colorMode} toggleColorMode={toggleColorMode} isCollapsed={isCollapsed} />
        </VStack>
      </Box>
    );
  }

  return (
    <Box width="100%">
      <Center width="100%" mb={1}>
        <HStack gap={3}>
          <ModelStatus isCollapsed={isCollapsed} />
          <GitHubLink isCollapsed={isCollapsed} />
          <ThemeToggle colorMode={colorMode} toggleColorMode={toggleColorMode} isCollapsed={isCollapsed} />
        </HStack>
      </Center>
    </Box>
  );
};

export default VersionInfo;
