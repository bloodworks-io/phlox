// Hook for managing RAG document collections state and operations.
import { useState, useEffect } from "react";
import { useCollapse } from "./useCollapse";
import { ragApi } from "../api/ragApi";
import { Steps } from "@chakra-ui/react";
import { useToast } from "@/utils/useToastShim";

export const useRagDocuments = () => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemToDelete, setItemToDelete] = useState(null);

  const collapseExplorer = useCollapse(false);
  const collapseUploader = useCollapse(false);

  const toast = useToast();

  useEffect(() => {
    const fetchCollections = async () => {
      setLoading(true);
      try {
        const data = await ragApi.fetchCollections();
        setCollections(
          data.files.map((name) => ({ name, files: [], loaded: false }))
        );
      } catch (error) {
        toast({
          title: "Error",
          description: error.message,
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchCollections();
  }, []);

  const handleDelete = async () => {
    try {
      if (itemToDelete.type === "file") {
        await ragApi.deleteFile(itemToDelete.collection, itemToDelete.name);
      } else {
        await ragApi.deleteCollection(itemToDelete.name);
      }
      const updatedCollections = await ragApi.fetchCollections();
      setCollections(
        updatedCollections.files.map((name) => ({
          name,
          files: [],
          loaded: false,
        }))
      );
      toast({
        title: "Success",
        description: `${
          itemToDelete.type === "file" ? "File" : "Collection"
        } deleted successfully`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to delete ${
          itemToDelete.type === "file" ? "file" : "collection"
        }`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setItemToDelete(null);
    }
  };

  return {
    collections,
    setCollections,
    loading,
    itemToDelete,
    setItemToDelete,
    handleDelete,
    collapseExplorer,
    collapseUploader,
  };
};
