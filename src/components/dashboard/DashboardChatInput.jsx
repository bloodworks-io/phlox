import React, { useState, useRef } from "react";
import {
  Box,
  Flex,
  Input,
  IconButton,
  Text,
  useColorMode,
  Image,
  HStack,
  Spinner,
} from "@chakra-ui/react";
import { ArrowUpIcon, AttachmentIcon, CloseIcon } from "@chakra-ui/icons";

const VALID_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "application/pdf",
];

const DashboardChatInput = ({
  value,
  onChange,
  onSend,
  isLoading,
  placeholder = "Message Phlox...",
  position = "centered", // "centered" | "bottom"
  showDisclaimer = true,
  pendingImage,
  onImageSelect,
  onImageRemove,
  isProcessingImage,
}) => {
  const { colorMode } = useColorMode();
  const isLight = colorMode === "light";
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const isBottom = position === "bottom";

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isProcessingImage) {
        onSend();
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (VALID_IMAGE_TYPES.includes(file.type) || file.name.match(/\.(png|jpe?g|gif|webp|pdf)$/i)) {
      if (onImageSelect) {
        onImageSelect(file);
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && onImageSelect) {
      onImageSelect(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const canSend = (value.trim() || pendingImage) && !isLoading && !isProcessingImage;

  return (
    <Flex
      position={isBottom ? "fixed" : "relative"}
      bottom={isBottom ? "20px" : "auto"}
      left={isBottom ? "50%" : "auto"}
      transform={isBottom ? "translateX(-50%)" : "none"}
      zIndex={isBottom ? "1000" : "auto"}
      direction="column"
      align="center"
      w="100%"
      maxW="800px"
      mx={isBottom ? "auto" : "0"}
      px={isBottom ? "20px" : "0"}
      flex={isBottom ? "none" : "0 0 auto"}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <Flex
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          align="center"
          justify="center"
          bg={isLight ? "rgba(49, 130, 206, 0.1)" : "rgba(99, 179, 237, 0.1)"}
          borderWidth="2px"
          borderStyle="dashed"
          borderColor="blue.400"
          borderRadius="lg"
          zIndex={20}
          pointerEvents="none"
        >
          <Text fontWeight="bold" color="blue.400">
            Drop image or PDF here
          </Text>
        </Flex>
      )}

      <Box
        className="dashboard-chat-input-container"
        w="100%"
        transition="all 0.3s ease"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        position="relative"
      >
        {/* Pending image preview */}
        {pendingImage && (
          <Box mb={2} p={2} borderRadius="md" bg={isLight ? "gray.100" : "gray.700"}>
            <HStack spacing={2}>
              {pendingImage.type.startsWith("image/") ? (
                <Image
                  src={URL.createObjectURL(pendingImage)}
                  alt="Preview"
                  maxH="60px"
                  maxW="100px"
                  borderRadius="sm"
                  objectFit="cover"
                />
              ) : (
                <Flex
                  align="center"
                  justify="center"
                  h="60px"
                  w="60px"
                  bg={isLight ? "gray.200" : "gray.600"}
                  borderRadius="sm"
                >
                  <Text fontSize="xs" fontWeight="bold" color="gray.500">
                    PDF
                  </Text>
                </Flex>
              )}
              <Text fontSize="sm" flex="1" isTruncated>
                {pendingImage.name}
              </Text>
              {isProcessingImage && <Spinner size="sm" />}
              <IconButton
                icon={<CloseIcon />}
                size="xs"
                aria-label="Remove image"
                onClick={onImageRemove}
                isDisabled={isProcessingImage}
              />
            </HStack>
          </Box>
        )}

        <Flex align="center" gap={2}>
          {/* File attachment button */}
          <IconButton
            icon={<AttachmentIcon />}
            onClick={() => fileInputRef.current?.click()}
            isDisabled={isLoading || isProcessingImage}
            aria-label="Attach image or PDF"
            size="sm"
            variant="ghost"
            color={isLight ? "gray.500" : "rgba(255, 255, 255, 0.6)"}
            _hover={{
              bg: isLight ? "gray.100" : "rgba(255, 255, 255, 0.1)",
            }}
          />
          <Input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            display="none"
            accept="image/*,.pdf"
          />

          <Input
            value={value}
            onChange={onChange}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            variant="unstyled"
            flex="1"
            color={isLight ? "gray.800" : "white"}
            _placeholder={{ color: isLight ? "gray.500" : "rgba(255, 255, 255, 0.6)" }}
            fontSize="md"
            isDisabled={isLoading || isProcessingImage}
          />
          <IconButton
            icon={<ArrowUpIcon />}
            onClick={onSend}
            isDisabled={!canSend}
            isLoading={isLoading}
            aria-label="Send message"
            size="sm"
            borderRadius="full"
            bg={
              canSend
                ? isLight
                  ? "gray.700"
                  : "white"
                : isLight
                  ? "gray.200"
                  : "rgba(255, 255, 255, 0.2)"
            }
            color={
              canSend
                ? isLight
                  ? "white"
                  : "gray.800"
                : isLight
                  ? "gray.400"
                  : "rgba(255, 255, 255, 0.5)"
            }
            _hover={{
              bg: canSend
                ? isLight
                  ? "gray.600"
                  : "gray.100"
                : isLight
                  ? "gray.300"
                  : "rgba(255, 255, 255, 0.3)",
              transform: "scale(1.05)",
            }}
            transition="all 0.2s ease"
          />
        </Flex>
      </Box>
      {showDisclaimer && (
        <Text
          textAlign="center"
          fontSize="xs"
          color="gray.500"
          mt={2}
          opacity={0.8}
        >
          Phlox may make mistakes. Always verify critical information.
        </Text>
      )}
    </Flex>
  );
};

export default DashboardChatInput;
