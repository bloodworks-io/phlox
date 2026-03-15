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
    Collapse,
    Spinner,
} from "@chakra-ui/react";
import {
    AddIcon,
    DeleteIcon,
    ChevronDownIcon,
    ChevronUpIcon,
} from "@chakra-ui/icons";

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
            <VStack align="stretch" spacing={2}>
                <HStack justify="space-between" align="center">
                    <Button
                        onClick={toggleCollapsed}
                        variant="link"
                        rightIcon={
                            isCollapsed ? (
                                <ChevronDownIcon />
                            ) : (
                                <ChevronUpIcon />
                            )
                        }
                        color="gray.500"
                        fontWeight="medium"
                        fontSize="sm"
                        textDecoration="none"
                        _hover={{ color: "gray.700", textDecoration: "none" }}
                    >
                        Todo list
                    </Button>
                    <Text fontSize="xs" color="gray.500">
                        {activeCount} active
                    </Text>
                </HStack>

                <Collapse in={!isCollapsed} animateOpacity>
                    <VStack align="stretch" spacing={2} pt={1}>
                        <Flex align="center" justify="space-between">
                            <Text fontSize="xs" color="gray.500">
                                Optional workspace tasks
                            </Text>
                            <Button
                                size="xs"
                                variant="link"
                                onClick={() =>
                                    setShowAllTodos?.((prev) => !prev)
                                }
                                color="gray.500"
                                _hover={{
                                    color: "gray.700",
                                    textDecoration: "none",
                                }}
                            >
                                {showAllTodos ? "Show active" : "Show all"}
                            </Button>
                        </Flex>

                        <HStack spacing={1}>
                            <Input
                                value={newTodo}
                                onChange={(e) => setNewTodo?.(e.target.value)}
                                onKeyDown={handleTodoKeyDown}
                                placeholder="Add a task..."
                                size="sm"
                                variant="flushed"
                                isDisabled={isSaving}
                            />
                            <IconButton
                                icon={
                                    isSaving ? (
                                        <Spinner size="xs" />
                                    ) : (
                                        <AddIcon />
                                    )
                                }
                                onClick={addTodo}
                                size="xs"
                                aria-label="Add todo"
                                variant="ghost"
                                isDisabled={isSaving}
                            />
                        </HStack>

                        <VStack
                            align="stretch"
                            spacing={1}
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
                                        <Checkbox
                                            isChecked={todo.completed}
                                            onChange={() =>
                                                toggleTodo?.(todo.id)
                                            }
                                            size="sm"
                                            isDisabled={isSaving}
                                        >
                                            <Text
                                                fontSize="sm"
                                                as={
                                                    todo.completed
                                                        ? "s"
                                                        : "span"
                                                }
                                                color={
                                                    todo.completed
                                                        ? "gray.500"
                                                        : "gray.600"
                                                }
                                            >
                                                {todo.task}
                                            </Text>
                                        </Checkbox>

                                        <IconButton
                                            icon={<DeleteIcon />}
                                            onClick={() =>
                                                deleteTodo?.(todo.id)
                                            }
                                            size="xs"
                                            variant="ghost"
                                            aria-label="Delete todo"
                                            isDisabled={isSaving}
                                            color="gray.400"
                                            _hover={{
                                                color: "red.400",
                                                bg: "transparent",
                                            }}
                                        />
                                    </HStack>
                                ))
                            ) : (
                                <Text fontSize="sm" color="gray.500" px={1}>
                                    No tasks yet.
                                </Text>
                            )}
                        </VStack>

                        {completedCount > 0 && (
                            <Text fontSize="xs" color="gray.400" pt={1}>
                                {completedCount} completed
                            </Text>
                        )}
                    </VStack>
                </Collapse>
            </VStack>
        </Box>
    );
};

export default DashboardTodoPanel;
