// Helper utilities for local model management
import { DEFAULT_TOAST_CONFIG } from "../constants";

export const localModelHelpers = {
  // Format model size from bytes to human readable
  formatModelSize: (sizeInBytes) => {
    if (!sizeInBytes) return "Unknown size";

    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = sizeInBytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  },

  // Format download progress percentage
  formatDownloadProgress: (progress) => {
    if (!progress || typeof progress.percentage !== "number") {
      return "0%";
    }
    return `${Math.round(progress.percentage)}%`;
  },

  // Calculate estimated time remaining for download
  calculateETA: (progress) => {
    if (!progress || !progress.speed || !progress.remaining_bytes) {
      return "Unknown";
    }

    const secondsRemaining = progress.remaining_bytes / progress.speed;

    if (secondsRemaining < 60) {
      return `${Math.round(secondsRemaining)}s`;
    } else if (secondsRemaining < 3600) {
      return `${Math.round(secondsRemaining / 60)}m`;
    } else {
      return `${Math.round(secondsRemaining / 3600)}h`;
    }
  },

  // Format download speed
  formatDownloadSpeed: (bytesPerSecond) => {
    if (!bytesPerSecond) return "0 B/s";

    const units = ["B/s", "KB/s", "MB/s", "GB/s"];
    let speed = bytesPerSecond;
    let unitIndex = 0;

    while (speed >= 1024 && unitIndex < units.length - 1) {
      speed /= 1024;
      unitIndex++;
    }

    return `${speed.toFixed(1)} ${units[unitIndex]}`;
  },

  // Check if model is compatible with system specifications
  isModelCompatible: (model, systemSpecs) => {
    if (!systemSpecs) return { compatible: true, reason: null };

    const issues = [];

    // Check RAM requirements
    if (model.min_ram_gb && systemSpecs.total_memory_gb) {
      if (systemSpecs.total_memory_gb < model.min_ram_gb) {
        issues.push(
          `Requires ${model.min_ram_gb}GB RAM, you have ${systemSpecs.total_memory_gb}GB`,
        );
      }
    }

    // Check GPU requirements
    if (model.requires_gpu && !systemSpecs.has_gpu) {
      issues.push("Requires GPU acceleration");
    }

    // Check architecture compatibility
    if (model.architecture && systemSpecs.architecture) {
      if (!model.supported_architectures?.includes(systemSpecs.architecture)) {
        issues.push(
          `Not compatible with ${systemSpecs.architecture} architecture`,
        );
      }
    }

    return {
      compatible: issues.length === 0,
      issues: issues,
      reason: issues.length > 0 ? issues.join(", ") : null,
    };
  },

  // Get compatibility badge props for UI
  getCompatibilityBadge: (model, systemSpecs) => {
    const compatibility = localModelHelpers.isModelCompatible(
      model,
      systemSpecs,
    );

    if (compatibility.compatible) {
      return {
        colorScheme: "green",
        text: "Compatible",
        icon: "check",
      };
    } else {
      return {
        colorScheme: "red",
        text: "Incompatible",
        icon: "warning",
        tooltip: compatibility.reason,
      };
    }
  },

  // Filter models based on search query
  filterModels: (models, searchQuery) => {
    if (!searchQuery.trim()) return models;

    const query = searchQuery.toLowerCase();
    return models.filter(
      (model) =>
        model.name?.toLowerCase().includes(query) ||
        model.description?.toLowerCase().includes(query) ||
        model.tags?.some((tag) => tag.toLowerCase().includes(query)),
    );
  },

  // Sort models by various criteria
  sortModels: (models, sortBy = "name", sortOrder = "asc") => {
    const sorted = [...models].sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case "name":
          aValue = a.name || "";
          bValue = b.name || "";
          break;
        case "size":
          aValue = a.size_bytes || 0;
          bValue = b.size_bytes || 0;
          break;
        case "created":
          aValue = new Date(a.created_at || 0);
          bValue = new Date(b.created_at || 0);
          break;
        case "downloads":
          aValue = a.download_count || 0;
          bValue = b.download_count || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  },

  // Get model performance tier based on parameters
  getModelTier: (model) => {
    if (!model.parameter_count) return "Unknown";

    const params = model.parameter_count;

    if (params < 1e9) {
      return {
        tier: "Small",
        color: "green",
        description: "Fast, basic capabilities",
      };
    } else if (params < 7e9) {
      return {
        tier: "Medium",
        color: "blue",
        description: "Balanced performance",
      };
    } else if (params < 13e9) {
      return {
        tier: "Large",
        color: "orange",
        description: "High performance",
      };
    } else {
      return {
        tier: "Extra Large",
        color: "red",
        description: "Maximum capability",
      };
    }
  },

  // Validate model name format
  isValidModelName: (name) => {
    if (!name || typeof name !== "string") return false;

    // Basic validation: alphanumeric, hyphens, underscores, colons, dots
    const validPattern = /^[a-zA-Z0-9._:-]+$/;
    return validPattern.test(name) && name.length > 0 && name.length <= 255;
  },

  // Extract model info from name/path
  parseModelName: (modelName) => {
    if (!modelName) return null;

    // Handle formats like "namespace/model:tag" or "model:tag"
    const parts = modelName.split("/");
    let namespace = null;
    let nameAndTag = modelName;

    if (parts.length > 1) {
      namespace = parts[0];
      nameAndTag = parts.slice(1).join("/");
    }

    const [name, tag] = nameAndTag.split(":");

    return {
      namespace,
      name: name || modelName,
      tag: tag || "latest",
      fullName: modelName,
    };
  },

  // Get recommended models based on system specs
  getRecommendedModels: (models, systemSpecs) => {
    if (!systemSpecs) return models;

    return models
      .filter(
        (model) =>
          localModelHelpers.isModelCompatible(model, systemSpecs).compatible,
      )
      .sort((a, b) => {
        // Prioritize models that fit well within system constraints
        const aRamRatio =
          (a.min_ram_gb || 0) / (systemSpecs.total_memory_gb || 1);
        const bRamRatio =
          (b.min_ram_gb || 0) / (systemSpecs.total_memory_gb || 1);

        // Prefer models that use 50-80% of available RAM
        const aOptimal = Math.abs(aRamRatio - 0.65);
        const bOptimal = Math.abs(bRamRatio - 0.65);

        return aOptimal - bOptimal;
      });
  },

  // Format model status for display
  formatModelStatus: (status) => {
    const statusMap = {
      available: { text: "Available", color: "green" },
      downloading: { text: "Downloading", color: "blue" },
      installing: { text: "Installing", color: "yellow" },
      error: { text: "Error", color: "red" },
      updating: { text: "Updating", color: "orange" },
      deleting: { text: "Deleting", color: "red" },
    };

    return statusMap[status] || { text: status || "Unknown", color: "gray" };
  },

  // Calculate storage requirements
  calculateStorageNeeds: (models) => {
    const totalSize = models.reduce(
      (sum, model) => sum + (model.size_bytes || 0),
      0,
    );

    return {
      totalSize: localModelHelpers.formatModelSize(totalSize),
      modelCount: models.length,
      averageSize: localModelHelpers.formatModelSize(
        totalSize / (models.length || 1),
      ),
    };
  },

  // Generate download filename from repo and file info
  generateDownloadFilename: (repoId, filename) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    return `${repoId}_${safeName}_${timestamp}`;
  },

  // Check if download is in progress
  isDownloadActive: (downloadId, activeDownloads) => {
    return activeDownloads instanceof Set
      ? activeDownloads.has(downloadId)
      : false;
  },

  // Validate repository ID format
  isValidRepoId: (repoId) => {
    if (!repoId || typeof repoId !== "string") return false;

    // Should match format like "microsoft/DialoGPT-medium" or similar
    const validPattern = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
    return validPattern.test(repoId);
  },

  // Create toast configuration for model operations
  createModelToast: (type, modelName, customMessage = null) => {
    const messages = {
      download_start: `Started downloading ${modelName}`,
      download_complete: `Successfully downloaded ${modelName}`,
      download_failed: `Failed to download ${modelName}`,
      delete_success: `Successfully deleted ${modelName}`,
      delete_failed: `Failed to delete ${modelName}`,
      pull_success: `Successfully pulled ${modelName}`,
      pull_failed: `Failed to pull ${modelName}`,
    };

    const statusMap = {
      download_start: "info",
      download_complete: "success",
      download_failed: "error",
      delete_success: "success",
      delete_failed: "error",
      pull_success: "success",
      pull_failed: "error",
    };

    return {
      title:
        type.includes("success") || type.includes("complete")
          ? "Success"
          : type.includes("failed") || type.includes("error")
            ? "Error"
            : "Info",
      description:
        customMessage || messages[type] || `Operation ${type} for ${modelName}`,
      status: statusMap[type] || "info",
      ...DEFAULT_TOAST_CONFIG,
      duration: type.includes("error") || type.includes("failed") ? 5000 : 3000,
    };
  },

  // Convert bytes to GB for memory calculations
  bytesToGB: (bytes) => {
    return Math.round((bytes / 1024 ** 3) * 100) / 100;
  },

  // Check if system has sufficient disk space
  hasSufficientDiskSpace: (requiredBytes, systemSpecs) => {
    if (!systemSpecs?.free_disk_space_bytes || !requiredBytes) {
      return { sufficient: true, reason: "Cannot determine disk space" };
    }

    const freeGB = localModelHelpers.bytesToGB(
      systemSpecs.free_disk_space_bytes,
    );
    const requiredGB = localModelHelpers.bytesToGB(requiredBytes);
    const bufferGB = Math.max(1, requiredGB * 0.1); // 10% buffer, minimum 1GB

    const sufficient = freeGB >= requiredGB + bufferGB;

    return {
      sufficient,
      freeGB,
      requiredGB,
      reason: sufficient
        ? null
        : `Insufficient disk space. Need ${requiredGB}GB, have ${freeGB}GB`,
    };
  },
};
