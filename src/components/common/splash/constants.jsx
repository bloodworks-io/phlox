import {
  FaUserMd,
  FaRobot,
  FaFileAlt,
  FaInfoCircle,
  FaLock,
} from "react-icons/fa";

export const SPLASH_STEPS = {
  ENCRYPTION: -1,
  ABOUT_YOU: 0,
  TEMPLATES: 1,
  AI_MODELS: 2,
  // Retained for hook compatibility — not shown in splash
  QUICK_CHAT: 4,
  LETTERS: 5,
};

export const STEP_TITLES = {
  [SPLASH_STEPS.ENCRYPTION]: "Secure Your Data",
  [SPLASH_STEPS.ABOUT_YOU]: "About You",
  [SPLASH_STEPS.AI_MODELS]: "AI Models",
  [SPLASH_STEPS.TEMPLATES]: "Choose Your Template",
};

export const STEP_DESCRIPTIONS = {
  [SPLASH_STEPS.ENCRYPTION]:
    "Create a passphrase to encrypt and protect your patient data.",
  [SPLASH_STEPS.ABOUT_YOU]:
    "Your name and specialty personalize your notes and letters.",
  [SPLASH_STEPS.TEMPLATES]:
    "Choose the note template you'll use for patient encounters.",
  [SPLASH_STEPS.AI_MODELS]:
    "Download a model to run on your Mac, or connect to an API.",
};

export const TEMPLATE_DESCRIPTIONS = {
  phlox_01:
    "Physician consultations — primary condition, history, impression, and plan.",
  soap_01: "Standard SOAP format — Subjective, Objective, Assessment, Plan.",
  progress_01: "Follow-up visits — interval history, current status, and plan.",
  procedure_01:
    "Procedural documentation — indication, details, complications.",
  consult_01:
    "Specialist consultations — reason, findings, impression, recommendations.",
};

export const getStepIcon = (step) => {
  switch (step) {
    case SPLASH_STEPS.ENCRYPTION:
      return FaLock;
    case SPLASH_STEPS.ABOUT_YOU:
      return FaUserMd;
    case SPLASH_STEPS.AI_MODELS:
      return FaRobot;
    case SPLASH_STEPS.TEMPLATES:
      return FaFileAlt;
    default:
      return FaInfoCircle;
  }
};
