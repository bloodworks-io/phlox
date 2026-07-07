import React from "react";
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
    ChevronDownIcon,
    ChevronUpIcon,
} from "../common/icons";

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
    const completedCount = todos.filter((todo) => todo.completed).length;
    const activeCount = Math.max(todos.length - completedCount, 0);

    return (
        <Box w="100%" maxW="760px" px={1} py={1}>
            <VStack align="stretch" gap={2}>
                <HStack justify="space-between" align="center">
                    <Button
                        onClick={toggleCollapsed}
                        variant='plain'
                        color="overlay0"
                        fontWeight="medium"
                        fontSize="sm"
                        textDecoration="none"
                        _hover={{ color: "textPrimary", textDecoration: "none" }}>Todo list
                                            {
                            isCollapsed ? (
                                <ChevronDownIcon />
                            ) : (
                                <ChevronUpIcon />
                            )
                        }</Button>
                    <Text fontSize="xs" color="overlay0">
                        {activeCount} active
                    </Text>
                </HStack>

                <Collapsible.Root open={!isCollapsed}>
                    <Collapsible.Content>
                        <VStack align="stretch" gap={2} pt={1}>
                            <Flex align="center" justify="space-between">
                                <Text fontSize="xs" color="overlay0">
                                    Optional workspace tasks
                                </Text>
                                <Button
                                    size="xs"
                                    variant='plain'
                                    onClick={() =>
                                        setShowAllTodos?.((prev) => !prev)
                                    }
                                    color="overlay0"
                                    _hover={{
                                        color: "textPrimary",
                                        textDecoration: "none",
                                    }}
                                >
                                    {showAllTodos ? "Show active" : "Show all"}
                                </Button>
                            </Flex>

                            <HStack gap={1}>
                                <Input
                                    value={newTodo}
                                    onChange={(e) => setNewTodo?.(e.target.value)}
                                    onKeyDown={handleTodoKeyDown}
                                    placeholder="Add a task..."
                                    size="sm"
                                    variant="flushed"
                                    disabled={isSaving}
                                />
                                <IconButton
                                    onClick={addTodo}
                                    size="xs"
                                    aria-label="Add todo"
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
                                                            ? "overlay0"
                                                            : "textTertiary"
                                                    }
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
                                                aria-label="Delete todo"
                                                disabled={isSaving}
                                                color="overlay0"
                                                _hover={{
                                                    color: "dangerButton",
                                                    bg: "transparent",
                                                }}><DeleteIcon /></IconButton>
                                        </HStack>
                                    ))
                                ) : (
                                    <Text fontSize="sm" color="overlay0" px={1}>
                                        No tasks yet.
                                    </Text>
                                )}
                            </VStack>

                            {completedCount > 0 && (
                                <Text fontSize="xs" color="overlay0" pt={1}>
                                    {completedCount} completed
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
