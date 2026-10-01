import {
  FaUserMd,
  FaRobot,
  FaFileAlt,
  FaInfoCircle,
  FaLock,
} from "react-icons/fa";
import { t } from "@/i18n";

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
  [SPLASH_STEPS.ENCRYPTION]: t("splash.step.encryption.title"),
  [SPLASH_STEPS.ABOUT_YOU]: t("splash.step.aboutYou.title"),
  [SPLASH_STEPS.AI_MODELS]: t("splash.step.aiModels.title"),
  [SPLASH_STEPS.TEMPLATES]: t("splash.step.templates.title"),
};

export const STEP_DESCRIPTIONS = {
  [SPLASH_STEPS.ENCRYPTION]: t("splash.step.encryption.description"),
  [SPLASH_STEPS.ABOUT_YOU]: t("splash.step.aboutYou.description"),
  [SPLASH_STEPS.TEMPLATES]: t("splash.step.templates.description"),
  [SPLASH_STEPS.AI_MODELS]: t("splash.step.aiModels.description"),
};

export const TEMPLATE_DESCRIPTIONS = {
  phlox_01: t("splash.template.phlox01"),
  soap_01: t("splash.template.soap01"),
  progress_01: t("splash.template.progress01"),
  procedure_01: t("splash.template.procedure01"),
  consult_01: t("splash.template.consult01"),
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
