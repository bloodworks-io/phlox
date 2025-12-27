// Component for managing a list of tasks or to-do items.
import React from "react";
import {
    Box,
    Flex,
    Text,
    VStack,
    HStack,
    Input,
    IconButton,
    Checkbox,
    Button,
} from "@chakra-ui/react";
import { AddIcon, DeleteIcon } from "@chakra-ui/icons";
import { FaTasks } from "react-icons/fa";

const TaskManagerPanel = ({
    todos,
    newTodo,
    setNewTodo,
    addTodo,
    toggleTodo,
    deleteTodo,
    showAll,
    toggleShowAll,
}) => {
    const visibleTodos = showAll
        ? todos
        : todos.filter((todo) => !todo.completed);

    return (
        <Box className="panels-bg" p="5" borderRadius="sm" shadow="sm">
            <Flex justify="space-between" align="center" mb="4">
                <HStack spacing={3}>
                    <FaTasks size="1.2em" />
                    <Text as="h3">Task Manager</Text>
                </HStack>
                <Button
                    size="sm"
                    onClick={toggleShowAll}
                    className="switch-mode"
                >
                    {showAll ? "Show Active" : "Show All"}
                </Button>
            </Flex>

            <VStack spacing={4}>
                <HStack w="full">
                    <Input
                        placeholder="New task..."
                        value={newTodo}
                        onChange={(e) => setNewTodo(e.target.value)}
                        className="input-style"
                    />
                    <IconButton
                        icon={<AddIcon />}
                        onClick={addTodo}
                        size="sm"
                        className="green-button"
                        borderRadius="sm"
                        aria-label="Add todo"
                    />
                </HStack>

                <Box
                    w="full"
                    maxH="300px"
                    overflowY="auto"
                    className="summary-panels"
                    borderRadius="sm"
                >
                    <VStack align="stretch" spacing={2} p={2}>
                        {visibleTodos.length > 0 ? (
                            visibleTodos.map((todo) => (
                                <HStack
                                    key={todo.id}
                                    p={3}
                                    borderWidth="1px"
                                    justify="space-between"
                                    className="landing-items"
                                    maxH="40px"
                                >
                                    <Checkbox
                                        isChecked={todo.completed}
                                        onChange={() =>
                                            toggleTodo(todo.id, todo.completed)
                                        }
                                    >
                                        <Text
                                            as={todo.completed ? "s" : "span"}
                                        >
                                            {todo.task}
                                        </Text>
                                    </Checkbox>
                                    <IconButton
                                        icon={<DeleteIcon />}
                                        onClick={() => deleteTodo(todo.id)}
                                        size="sm"
                                        variant="ghost"
                                        colorScheme="red"
                                        aria-label="Delete todo"
                                    />
                                </HStack>
                            ))
                        ) : (
                            <Flex
                                direction="column"
                                align="center"
                                justify="center"
                                py={8}
                                color="gray.500"
                            >
                                <Text>No tasks yet</Text>
                            </Flex>
                        )}
                    </VStack>
                </Box>
            </VStack>
        </Box>
    );
};

export default TaskManagerPanel;
