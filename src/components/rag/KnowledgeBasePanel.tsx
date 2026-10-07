// Panel component for the Knowledge Base tab — document explorer and uploader.
import React from "react";
import { VStack } from "@chakra-ui/react";
import DocumentExplorer from "./DocumentExplorer";
import Uploader from "./Uploader";
import type {
    CollapseState,
    DocumentCollection,
    ItemToDelete,
} from "./types";

interface KnowledgeBasePanelProps {
    collapseExplorer: CollapseState;
    collapseUploader: CollapseState;
    collections: DocumentCollection[];
    setCollections: React.Dispatch<React.SetStateAction<DocumentCollection[]>>;
    loading: boolean;
    setItemToDelete: (item: ItemToDelete | null) => void;
}

const KnowledgeBasePanel = ({
    collapseExplorer,
    collapseUploader,
    collections,
    setCollections,
    loading,
    setItemToDelete,
}: KnowledgeBasePanelProps) => (
  <VStack gap="5" align="stretch">
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
