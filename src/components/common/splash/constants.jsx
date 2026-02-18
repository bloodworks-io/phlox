import {
  FaUserMd,
  FaRobot,
  FaMicrophone,
  FaFileAlt,
  FaComments,
  FaEnvelope,
  FaInfoCircle,
  FaLock,
} from "react-icons/fa";

export const SPLASH_STEPS = {
  ENCRYPTION: -1,
  PERSONAL: 0,
  LLM: 1,
  TRANSCRIPTION: 2,
  TEMPLATES: 3,
  QUICK_CHAT: 4,
  LETTERS: 5,
};

export const STEP_TITLES = {
  [SPLASH_STEPS.ENCRYPTION]: "Secure Your Data",
  [SPLASH_STEPS.PERSONAL]: "Personal Information",
  [SPLASH_STEPS.LLM]: "Language Model Setup",
  [SPLASH_STEPS.TRANSCRIPTION]: "Transcription Setup",
  [SPLASH_STEPS.TEMPLATES]: "Choose Default Template",
  [SPLASH_STEPS.QUICK_CHAT]: "Quick Chat Buttons",
  [SPLASH_STEPS.LETTERS]: "Letter Templates",
};

export const STEP_DESCRIPTIONS = {
  [SPLASH_STEPS.ENCRYPTION]: "Create a passphrase to encrypt and protect your patient data",
  [SPLASH_STEPS.PERSONAL]: "Tell us about yourself to personalize your experience",
  [SPLASH_STEPS.LLM]: "Configure your AI language model for medical assistance",
  [SPLASH_STEPS.TRANSCRIPTION]: "Set up voice transcription (optional but recommended)",
  [SPLASH_STEPS.TEMPLATES]: "Select your preferred clinical note template",
  [SPLASH_STEPS.QUICK_CHAT]: "Customize your quick chat buttons for common queries",
  [SPLASH_STEPS.LETTERS]: "Choose your default letter template for correspondence",
};

export const TEMPLATE_DESCRIPTIONS = {
  phlox_01:
    "Designed for physician consultations with sections for primary condition, other problems, investigations, current history, impression, and plan.",
  soap_01:
    "Standard SOAP format with Subjective, Objective, Assessment, and Plan sections - ideal for general consultations.",
  progress_01:
    "Perfect for follow-up visits with sections for interval history, current status, and plan.",
};

export const getStepIcon = (step) => {
  switch (step) {
    case SPLASH_STEPS.ENCRYPTION:
      return FaLock;
    case SPLASH_STEPS.PERSONAL:
      return FaUserMd;
    case SPLASH_STEPS.LLM:
      return FaRobot;
    case SPLASH_STEPS.TRANSCRIPTION:
      return FaMicrophone;
    case SPLASH_STEPS.TEMPLATES:
      return FaFileAlt;
    case SPLASH_STEPS.QUICK_CHAT:
      return FaComments;
    case SPLASH_STEPS.LETTERS:
      return FaEnvelope;
    default:
      return FaInfoCircle;
  }
};

// Animation variants
export const containerVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94],
      when: "beforeChildren",
      staggerChildren: 0.08,
    },
  },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

export const stepVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    x: -50,
    transition: {
      duration: 0.3,
      ease: "easeIn",
    },
  },
};
