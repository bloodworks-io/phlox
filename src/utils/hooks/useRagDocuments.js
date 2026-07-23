// Hook for managing RAG document collections state and operations.
import { useState, useEffect } from "react";
import { useCollapse } from "./useCollapse";
import { ragApi } from "../api/ragApi";
import { toaster } from "@/components/ui/toaster";

export const useRagDocuments = () => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemToDelete, setItemToDelete] = useState(null);

  const collapseExplorer = useCollapse(false);
  const collapseUploader = useCollapse(false);


  useEffect(() => {
    const fetchCollections = async () => {
      setLoading(true);
      try {
        const data = await ragApi.fetchCollections();
        setCollections(
          data.files.map((name) => ({ name, files: [], loaded: false }))
        );
      } catch (error) {
        toaster.create({
          title: "Error",
          description: error.message,
          type: "error",
          duration: 3000,
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
      toaster.create({
        title: "Success",
        description: `${
          itemToDelete.type === "file" ? "File" : "Collection"
        } deleted successfully`,
        type: "success",
        duration: 3000,
      });
    } catch {
      toaster.create({
        title: "Error",
        description: `Failed to delete ${
          itemToDelete.type === "file" ? "file" : "collection"
        }`,
        type: "error",
        duration: 3000,
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
