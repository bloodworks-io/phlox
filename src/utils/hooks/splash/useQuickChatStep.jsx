import { useState } from "react";
import { validateQuickChatStep } from "../../../utils/splash/validators";

export const useQuickChatStep = () => {
  const [quickChat1Title, setQuickChat1Title] = useState("Critique my plan");
  const [quickChat1Prompt, setQuickChat1Prompt] = useState(
    "Critique my plan",
  );
  const [quickChat2Title, setQuickChat2Title] = useState(
    "Any additional investigations",
  );
  const [quickChat2Prompt, setQuickChat2Prompt] = useState(
    "Any additional investigations",
  );
  const [quickChat3Title, setQuickChat3Title] = useState(
    "Any differentials to consider",
  );
  const [quickChat3Prompt, setQuickChat3Prompt] = useState(
    "Any differentials to consider",
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
