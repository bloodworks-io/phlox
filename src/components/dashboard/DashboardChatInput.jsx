import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    Box,
    Flex,
    Textarea,
    IconButton,
    Text,
    Image,
    HStack,
    Spinner,
    Input,
    Icon,
} from "@chakra-ui/react";
import { ArrowUpIcon, AttachmentIcon, CloseIcon } from "../common/icons";
import { LuFileText } from "react-icons/lu";

const VALID_IMAGE_TYPES = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "application/pdf",
];

const MIN_TEXTAREA_HEIGHT = 32;
const MAX_TEXTAREA_HEIGHT = 72; // ~3 lines, then scroll

const DashboardChatInput = ({
    value,
    onChange,
    onSend,
    isLoading,
    placeholder,
    position = "centered", // "centered" | "bottom"
    showDisclaimer = true,
    pendingImage,
    onImageSelect,
    onImageRemove,
    isProcessingImage,
}) => {
    const { t } = useTranslation();
    const [isDragOver, setIsDragOver] = useState(false);

    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);

    const isBottom = position === "bottom";
    const inputValue = value || "";

    const resizeTextarea = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = "auto";
        const nextHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT);
        textarea.style.height = `${Math.max(nextHeight, MIN_TEXTAREA_HEIGHT)}px`;
        textarea.style.overflowY =
            textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
    };

    useEffect(() => {
        resizeTextarea();
    }, [inputValue]);

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!isProcessingImage) {
                onSend();
            }
        }
    };

    const handleTextChange = (e) => {
        if (onChange) onChange(e);
        resizeTextarea();
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
        if (
            VALID_IMAGE_TYPES.includes(file.type) ||
            file.name.match(/\.(png|jpe?g|gif|pdf)$/i)
        ) {
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

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const canSend =
        (inputValue.trim() || pendingImage) && !isLoading && !isProcessingImage;

    return (
        <Flex
            position="relative"
            direction="column"
            align="center"
            w="100%"
            maxW="800px"
            mx="auto"
            px="20px"
            pt={isBottom ? "2" : "0"}
            pb={isBottom ? "0" : "0"}
            flex="0 0 auto"
        >
            {isDragOver && (
                <Flex
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                    bottom={0}
                    align="center"
                    justify="center"
                    bg="folio.accentSoft"
                    borderWidth="2px"
                    borderStyle="dashed"
                    borderColor="folio.accent"
                    borderRadius="folioOverlay"
                    zIndex={20}
                    pointerEvents="none"
                    className="anim-fade-scale"
                    css={{ animationDuration: "0.15s" }}
                >
                    <Text fontWeight="bold" color="folio.accent">
                        {t("chat.attachment.dropHere")}
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
                {pendingImage && (
                    <HStack
                        gap={2}
                        mb={2}
                        px={2}
                        py={1.5}
                        borderRadius="folioControl"
                        bg="folio.paperAlt"
                        border="1px solid"
                        borderColor="folio.line"
                        maxW="33%"
                        className="anim-fade-slide-up"
                        css={{ animationDuration: "0.15s" }}
                    >
                        {pendingImage.type.startsWith("image/") ? (
                            <Image
                                src={URL.createObjectURL(pendingImage)}
                                alt={t("chat.attachment.previewAlt")}
                                boxSize="20px"
                                borderRadius="sm"
                                objectFit="cover"
                                flexShrink={0}
                            />
                        ) : (
                            <Icon
                                boxSize={3.5}
                                color="folio.info"
                                flexShrink={0}
                                asChild
                            >
                                <LuFileText strokeWidth={1.6} />
                            </Icon>
                        )}
                        <Text fontSize="xs" flex="1" minW="0" truncate>
                            {pendingImage.name}
                        </Text>
                        {isProcessingImage && (
                            <Spinner size="xs" flexShrink={0} />
                        )}
                        <IconButton
                            size="xs"
                            variant="ghost"
                            aria-label={t("chat.attachment.removeFile")}
                            onClick={onImageRemove}
                            disabled={isProcessingImage}
                            flexShrink={0}
                            minW="auto"
                            h="auto"
                            p={0.5}
                        >
                            <CloseIcon />
                        </IconButton>
                    </HStack>
                )}

                <Textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder ?? t("chat.input.placeholder")}
                    rows={1}
                    resize="none"
                    variant="unstyled"
                    w="100%"
                    minH={`${MIN_TEXTAREA_HEIGHT}px`}
                    maxH={`${MAX_TEXTAREA_HEIGHT}px`}
                    py="1.5"
                    px="3"
                    lineHeight="1.35"
                    color="folio.ink"
                    _placeholder={{
                        color: "folio.faint",
                    }}
                    fontSize="md"
                    disabled={isLoading || isProcessingImage}
                    _focusVisible={{ boxShadow: "none" }}
                />

                <Flex align="center" justify="space-between" mt={1}>
                    <HStack gap={1}>
                        <IconButton
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading || isProcessingImage}
                            aria-label={t("chat.attachment.attach")}
                            size="sm"
                            variant="ghost"
                            color="folio.muted"
                            _hover={{
                                bg: "folio.hover",
                                color: "folio.ink",
                            }}
                        >
                            <AttachmentIcon />
                        </IconButton>
                        <Input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            display="none"
                            accept="image/png,image/jpeg,image/jpg,image/gif,.png,.jpg,.jpeg,.gif,.pdf"
                        />
                    </HStack>

                    <IconButton
                        onClick={onSend}
                        disabled={!canSend}
                        loading={isLoading}
                        aria-label={t("chat.input.send")}
                        size="sm"
                        alignSelf="center"
                        variant="folioPrimary"
                        borderRadius="full"
                    >
                        <ArrowUpIcon />
                    </IconButton>
                </Flex>
            </Box>
            {showDisclaimer && (
                <Text
                    textAlign="center"
                    fontSize="xs"
                    color="folio.muted"
                    mt={2}
                >
                    {t("chat.disclaimer")}
                </Text>
            )}
        </Flex>
    );
};

export default DashboardChatInput;
