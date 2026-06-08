// Panel component for the Knowledge Base tab — document explorer and uploader.
import React from "react";
import { VStack } from "@chakra-ui/react";
import DocumentExplorer from "./DocumentExplorer";
import Uploader from "./Uploader";

const KnowledgeBasePanel = ({
  collapseExplorer,
  collapseUploader,
  collections,
  setCollections,
  loading,
  setItemToDelete,
}) => (
  <VStack spacing="5" align="stretch">
    <DocumentExplorer
      isCollapsed={collapseExplorer.isCollapsed}
      setIsCollapsed={collapseExplorer.toggle}
      collections={collections}
      setCollections={setCollections}
      loading={loading}
      setItemToDelete={setItemToDelete}
    />
    <Uploader
      isCollapsed={collapseUploader.isCollapsed}
      setIsCollapsed={collapseUploader.toggle}
      setCollections={setCollections}
    />
  </VStack>
);

export default KnowledgeBasePanel;
