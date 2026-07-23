import { useState } from "react";
import { validateQuickChatStep } from "../../../utils/splash/validators";

export const useQuickChatStep = () => {
  const [quickChat1Title, setQuickChat1Title] = useState("Review my plan");
  const [quickChat1Prompt, setQuickChat1Prompt] = useState(
    "Review my plan",
  );
  const [quickChat2Title, setQuickChat2Title] = useState(
    "Additional points to review",
  );
  const [quickChat2Prompt, setQuickChat2Prompt] = useState(
    "Additional points to review",
  );
  const [quickChat3Title, setQuickChat3Title] = useState(
    "Other conditions worth reviewing",
  );
  const [quickChat3Prompt, setQuickChat3Prompt] = useState(
    "Other conditions worth reviewing",
  );

  return {
    quickChat1Title,
    setQuickChat1Title,
    quickChat1Prompt,
    setQuickChat1Prompt,
    quickChat2Title,
    setQuickChat2Title,
    quickChat2Prompt,
    setQuickChat2Prompt,
    quickChat3Title,
    setQuickChat3Title,
    quickChat3Prompt,
    setQuickChat3Prompt,
    validate: () =>
      validateQuickChatStep(
        quickChat1Title,
        quickChat1Prompt,
        quickChat2Title,
        quickChat2Prompt,
        quickChat3Title,
        quickChat3Prompt,
      ),
    getData: () => ({
      quickChat1Title,
      quickChat1Prompt,
      quickChat2Title,
      quickChat2Prompt,
      quickChat3Title,
      quickChat3Prompt,
    }),
  };
};
