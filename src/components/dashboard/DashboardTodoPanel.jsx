import React from "react";
import { useTranslation } from "react-i18next";
import {
    Box,
    Flex,
    VStack,
    HStack,
    Text,
    Input,
    IconButton,
    Button,
    Checkbox,
    Collapsible,
    Spinner,
} from "@chakra-ui/react";
import {
    AddIcon,
    DeleteIcon,
} from "../common/icons";
import AnimatedChevron from "../common/icons/AnimatedChevron";

const DashboardTodoPanel = ({
    todos = [],
    visibleTodos = [],
    newTodo = "",
    setNewTodo,
    showAllTodos = false,
    setShowAllTodos,
    isCollapsed = true,
    toggleCollapsed,
    isLoading = false,
    isSaving = false,
    addTodo,
    toggleTodo,
    deleteTodo,
    handleTodoKeyDown,
}) => {
    const { t } = useTranslation();
    const completedCount = todos.filter((todo) => todo.completed).length;
    const activeCount = Math.max(todos.length - completedCount, 0);

    return (
        <Box
            w="100%"
            maxW="760px"
            px={3}
            py={3}
            bg="folio.paper"
            border="1px solid"
            borderColor="folio.line"
            borderRadius="folioPanel"
            boxShadow="overlay"
        >
            <VStack align="stretch" gap={2}>
                <HStack justify="space-between" align="center">
                    <Button
                        onClick={toggleCollapsed}
                        variant='plain'
                        color="folio.muted"
                        fontWeight="medium"
                        fontSize="sm"
                        textDecoration="none"
                        _hover={{ color: "folio.ink", textDecoration: "none" }}>{t("dashboard.todos.title")}
                                            {
                            <AnimatedChevron isOpen={!isCollapsed} direction="up" />
                        }</Button>
                    <Text fontSize="xs" color="folio.muted">
                        {t("dashboard.todos.activeCount", {
                            count: activeCount,
                        })}
                    </Text>
                </HStack>

                <Collapsible.Root open={!isCollapsed}>
                    <Collapsible.Content>
                        <VStack align="stretch" gap={2} pt={1}>
                            <Flex align="center" justify="space-between">
                                <Text fontSize="xs" color="folio.muted">
                                    {t("dashboard.todos.optional")}
                                </Text>
                                <Button
                                    size="xs"
                                    variant='plain'
                                    onClick={() =>
                                        setShowAllTodos?.((prev) => !prev)
                                    }
                                    color="folio.muted"
                                    _hover={{
                                        color: "folio.ink",
                                        textDecoration: "none",
                                    }}
                                >
                                    {showAllTodos
                                        ? t("dashboard.todos.showActive")
                                        : t("dashboard.todos.showAll")}
                                </Button>
                            </Flex>

                            <HStack gap={1}>
                                <Input
                                    value={newTodo}
                                    onChange={(e) => setNewTodo?.(e.target.value)}
                                    onKeyDown={handleTodoKeyDown}
                                    placeholder={t("dashboard.todos.addPlaceholder")}
                                    size="sm"
                                    variant="flushed"
                                    disabled={isSaving}
                                />
                                <IconButton
                                    onClick={addTodo}
                                    size="xs"
                                    aria-label={t("dashboard.todos.add")}
                                    variant="ghost"
                                    disabled={isSaving}>{isSaving ? (
                                        <Spinner size="xs" />
                                    ) : (
                                        <AddIcon />
                                    )}</IconButton>
                            </HStack>

                            <VStack
                                align="stretch"
                                gap={1}
                                maxH="180px"
                                overflowY="auto"
                                pt={0.5}
                            >
                                {isLoading ? (
                                    <Flex align="center" justify="center" py={3}>
                                        <Spinner size="sm" />
                                    </Flex>
                                ) : visibleTodos.length > 0 ? (
                                    visibleTodos.map((todo) => (
                                        <HStack
                                            key={todo.id}
                                            align="center"
                                            justify="space-between"
                                            py={1}
                                            className="anim-fade-slide-up"
                                            css={{ animationDuration: "0.15s" }}
                                        >
                                            <Checkbox.Root
                                                onCheckedChange={() =>
                                                    toggleTodo?.(todo.id)
                                                }
                                                size="sm"
                                                disabled={isSaving}
                                                checked={todo.completed}
                                            ><Checkbox.HiddenInput /><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control><Checkbox.Label>
                                                <Text
                                                    fontSize="sm"
                                                    as={
                                                        todo.completed
                                                            ? "s"
                                                            : "span"
                                                    }
                                                    color={
                                                        todo.completed
                                                            ? "folio.success"
                                                            : "folio.ink"
                                                    }
                                                    transition="color 160ms ease"
                                                >
                                                    {todo.task}
                                                </Text>
                                            </Checkbox.Label></Checkbox.Root>

                                            <IconButton
                                                onClick={() =>
                                                    deleteTodo?.(todo.id)
                                                }
                                                size="xs"
                                                variant="ghost"
                                                aria-label={t(
                                                    "dashboard.todos.delete",
                                                )}
                                                disabled={isSaving}
                                                color="folio.muted"
                                                _hover={{
                                                    color: "folio.danger",
                                                    bg: "transparent",
                                                }}><DeleteIcon /></IconButton>
                                        </HStack>
                                    ))
                                ) : (
                                    <Text fontSize="sm" color="folio.muted" px={1}>
                                        {t("dashboard.todos.empty")}
                                    </Text>
                                )}
                            </VStack>

                            {completedCount > 0 && (
                                <Text fontSize="xs" color="folio.muted" pt={1}>
                                    {t("dashboard.todos.completedCount", {
                                        count: completedCount,
                                    })}
                                </Text>
                            )}
                        </VStack>
                    </Collapsible.Content>
                </Collapsible.Root>
            </VStack>
        </Box>
    );
};

export default DashboardTodoPanel;
