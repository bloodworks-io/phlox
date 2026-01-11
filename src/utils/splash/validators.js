export const validatePersonalStep = (name, specialty) => {
  return name.trim() && specialty;
};

export const validateLLMStep = (availableModels, primaryModel) => {
  if (availableModels.length > 0 && !primaryModel) {
    return false;
  }
  return true;
};

export const validateTranscriptionStep = (
  whisperBaseUrl,
  whisperModelListAvailable,
  availableWhisperModels,
  whisperModel
) => {
  if (whisperBaseUrl.trim() === "") {
    return true; // Optional step
  }
  if (
    whisperModelListAvailable &&
    availableWhisperModels.length > 0 &&
    !whisperModel
  ) {
    return false;
  }
  if (
    !whisperModelListAvailable &&
    whisperBaseUrl.trim() !== "" &&
    !whisperModel
  ) {
    return false;
  }
  return true;
};

export const validateTemplatesStep = (selectedTemplate) => {
  return selectedTemplate !== "";
};

export const validateQuickChatStep = (
  quickChat1Title,
  quickChat1Prompt,
  quickChat2Title,
  quickChat2Prompt,
  quickChat3Title,
  quickChat3Prompt
) => {
  return (
    quickChat1Title.trim() &&
    quickChat1Prompt.trim() &&
    quickChat2Title.trim() &&
    quickChat2Prompt.trim() &&
    quickChat3Title.trim() &&
    quickChat3Prompt.trim()
  );
};

export const validateLettersStep = (selectedLetterTemplate) => {
  return selectedLetterTemplate !== "";
};
