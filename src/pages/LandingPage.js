// Landing page component displaying various dashboard panels.
import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, Grid, VStack, useToast } from "@chakra-ui/react";
import { FaFileAlt } from "react-icons/fa";
import { landingApi } from "../utils/api/landingApi";
import { universalFetch } from "../utils/helpers/apiHelpers";
import DailyAnalysisPanel from "../components/landing/DailyAnalysisPanel";
import NewsDigestPanel from "../components/landing/NewsDigestPanel";
import TaskManagerPanel from "../components/landing/TaskManagerPanel";
import RssFeedPanel from "../components/landing/RssFeedPanel";
import ServerInfoPanel from "../components/landing/ServerInfoPanel";

const LandingPage = () => {
  const [feeds, setFeeds] = useState([]);
  const [newFeedUrl, setNewFeedUrl] = useState("");
  // eslint-disable-next-line no-unused-vars
  const [rssItems, setRssItems] = useState([]);
  const [incompleteJobs, setIncompleteJobs] = useState(0);
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState("");
  const [rssDigests, setRssDigests] = useState({
    combined_digest: "",
    articles: [],
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [isAnalysisRefreshing, setIsAnalysisRefreshing] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [isServerInfoRefreshing, setIsServerInfoRefreshing] = useState(false);
  const toast = useToast();

  const fetchAllData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [
        feedsResponse,
        jobsResponse,
        todosResponse,
        digestsResponse,
        analysisResponse,
      ] = await Promise.all([
        landingApi.fetchFeeds(),
        landingApi.fetchIncompleteJobs(),
        fetchTodos(),
        landingApi.fetchRssDigests(),
        landingApi.fetchAnalysis(),
      ]);

      setFeeds(feedsResponse.feeds);
      setIncompleteJobs(jobsResponse.incomplete_jobs_count);
      setTodos(todosResponse);
      setRssDigests(digestsResponse);
      setAnalysis(analysisResponse);
    } catch (error) {
      toast({
        title: "Error fetching data",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [toast]);

  const fetchTodos = async () => {
    try {
      const response = await universalFetch("/api/dashboard/todos");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setTodos(data.todos || []);
      return data.todos;
    } catch (error) {
      console.error("Error fetching todos:", error);
      toast({
        title: "Error fetching todos",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return [];
    }
  };

  const addTodo = async () => {
    if (newTodo.trim()) {
      try {
        const response = await landingApi.addTodo(newTodo);
        setTodos([...todos, response.todo]);
        setNewTodo("");
        setIncompleteJobs((prev) => prev + 1);
      } catch (error) {}
    }
  };

  const toggleTodo = async (id, completed) => {
    try {
      const todoToUpdate = todos.find((todo) => todo.id === id);
      if (!todoToUpdate) {
        throw new Error("Todo not found");
      }

      const response = await landingApi.toggleTodo(
        id,
        completed,
        todoToUpdate.task,
      );
      setTodos(todos.map((todo) => (todo.id === id ? response.todo : todo)));
      setIncompleteJobs((prev) => (completed ? prev - 1 : prev + 1));
    } catch (error) {}
  };

  const deleteTodo = async (id) => {
    try {
      await landingApi.deleteTodo(id);
      setTodos(todos.filter((todo) => todo.id !== id));
      setIncompleteJobs((prev) => prev - 1);
    } catch (error) {}
  };

  const addFeed = async () => {
    if (newFeedUrl) {
      try {
        await landingApi.addFeed(newFeedUrl);
        setNewFeedUrl("");
        const updatedFeeds = await landingApi.fetchFeeds();
        setFeeds(updatedFeeds.feeds);
      } catch (error) {}
    }
  };

  const removeFeed = async (feedId) => {
    try {
      await landingApi.removeFeed(feedId);
      const updatedFeeds = await landingApi.fetchFeeds();
      setFeeds(updatedFeeds.feeds);
    } catch (error) {
      // Error handled by handleApiRequest
    }
  };

  const refreshAllFeeds = async () => {
    try {
      setIsRefreshing(true);
      await landingApi.refreshAllFeeds();
      const updatedFeeds = await landingApi.fetchFeeds();
      setFeeds(updatedFeeds.feeds);

      fetchRssItems();
      const digest = await landingApi.fetchRssDigests();
      setRssDigests(digest);
    } catch (error) {
      // Error handled by handleApiRequest
    } finally {
      setIsRefreshing(false);
    }
  };
  const refreshSingleFeed = async (feedId) => {
    setIsRefreshing(true);
    try {
      await landingApi.refreshSingleFeed(feedId);
      const updatedFeeds = await landingApi.fetchFeeds();
      setFeeds(updatedFeeds.feeds);
      fetchRssItems();
      const digest = await landingApi.fetchRssDigests();
      setRssDigests(digest);
    } catch (error) {
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchRssItems = useCallback(async () => {
    try {
      const response = await landingApi.fetchRssItems(feeds);
      setRssItems(response.items);
    } catch (error) {
      setRssItems([]);
    }
  }, [feeds]);

  const refreshAnalysis = async () => {
    try {
      setIsAnalysisRefreshing(true);
      await landingApi.refreshAnalysis();

      // Start polling for the new analysis
      const pollInterval = setInterval(async () => {
        try {
          const response = await landingApi.fetchAnalysis();
          if (!response.is_processing) {
            // New analysis is ready
            setAnalysis(response);
            setIsAnalysisRefreshing(false);
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error("Error polling analysis:", error);
          setIsAnalysisRefreshing(false);
          clearInterval(pollInterval);
          toast({
            title: "Error getting new analysis",
            status: "error",
            duration: 3000,
            isClosable: true,
          });
        }
      }, 2000); // Poll every 2 seconds

      // Set a timeout to stop polling after 30 seconds
      setTimeout(() => {
        if (pollInterval) {
          clearInterval(pollInterval);
          setIsAnalysisRefreshing(false);
          toast({
            title: "Analysis refresh timed out",
            description: "Please try again later",
            status: "warning",
            duration: 3000,
            isClosable: true,
          });
        }
      }, 30000);
    } catch (error) {
      console.error("Error refreshing analysis:", error);
      toast({
        title: "Error refreshing analysis",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      setIsAnalysisRefreshing(false);
    }
  };

  const fetchServerInfo = useCallback(async () => {
    try {
      setIsServerInfoRefreshing(true);
      const response = await landingApi.fetchServerInfo();
      setServerInfo(response);
    } catch (error) {
      console.error("Error fetching server info:", error);
      toast({
        title: "Error fetching server information",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsServerInfoRefreshing(false);
    }
  }, [toast]);

  const refreshRssDigests = async () => {
    try {
      setIsRefreshing(true);
      const digest = await landingApi.refreshRssDigests();
      setRssDigests(digest);
    } catch (error) {
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleShowAll = () => setShowAll(!showAll);

  useEffect(() => {
    fetchAllData();
    fetchServerInfo();
  }, [fetchAllData, fetchServerInfo]);

  useEffect(() => {
    if (feeds && feeds.length > 0) {
      fetchRssItems();
    }
  }, [feeds, fetchRssItems]);
  return (
    <Box p="5" maxW="1400px" mx="auto">
      <Text as="h1" textAlign="center" mb="6">
        Phlox Dashboard
      </Text>
      <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={6}>
        {/* Left Column - Main Content */}
        <VStack spacing={6} align="stretch">
          <DailyAnalysisPanel
            analysis={analysis}
            incompleteJobs={incompleteJobs}
            isAnalysisRefreshing={isAnalysisRefreshing}
            refreshAnalysis={refreshAnalysis}
            FaFileAlt={FaFileAlt}
          />
          <NewsDigestPanel
            rssDigests={rssDigests}
            isRefreshing={isRefreshing}
            refreshRssDigests={refreshRssDigests}
          />
        </VStack>

        {/* Right Column - Todo & RSS Management */}
        <VStack spacing={6} align="stretch">
          <TaskManagerPanel
            todos={todos}
            newTodo={newTodo}
            setNewTodo={setNewTodo}
            addTodo={addTodo}
            toggleTodo={toggleTodo}
            deleteTodo={deleteTodo}
            showAll={showAll}
            toggleShowAll={toggleShowAll}
          />
          <RssFeedPanel
            feeds={feeds}
            newFeedUrl={newFeedUrl}
            setNewFeedUrl={setNewFeedUrl}
            addFeed={addFeed}
            removeFeed={removeFeed}
            refreshAllFeeds={refreshAllFeeds}
            refreshSingleFeed={refreshSingleFeed}
            isRefreshing={isRefreshing}
          />
          <ServerInfoPanel
            serverInfo={serverInfo}
            isServerInfoRefreshing={isServerInfoRefreshing}
            fetchServerInfo={fetchServerInfo}
          />
        </VStack>
      </Grid>
    </Box>
  );
};

export default LandingPage;
