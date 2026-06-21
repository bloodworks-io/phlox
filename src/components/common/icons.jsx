// Local icon wrappers.

import { Icon } from "@chakra-ui/react";
import {
    FiAlertTriangle,
    FiArrowUp,
    FiCheck,
    FiCheckCircle,
    FiChevronDown,
    FiChevronLeft,
    FiChevronRight,
    FiChevronUp,
    FiCopy,
    FiDownload,
    FiEdit2,
    FiExternalLink,
    FiHelpCircle,
    FiInfo,
    FiMinus,
    FiPaperclip,
    FiPlus,
    FiRefreshCw,
    FiSearch,
    FiSettings,
    FiTrash2,
    FiX,
    FiMessageSquare,
} from "react-icons/fi";
import { BsExclamationTriangleFill } from "react-icons/bs";

export const AddIcon = (props) => <Icon as={FiPlus} {...props} />;
export const ArrowUpIcon = (props) => <Icon as={FiArrowUp} {...props} />;
export const AttachmentIcon = (props) => <Icon as={FiPaperclip} {...props} />;
export const ChatIcon = (props) => <Icon as={FiMessageSquare} {...props} />;
export const CheckCircleIcon = (props) => (
    <Icon as={FiCheckCircle} {...props} />
);
export const CheckIcon = (props) => <Icon as={FiCheck} {...props} />;
export const ChevronDownIcon = (props) => (
    <Icon as={FiChevronDown} {...props} />
);
export const ChevronLeftIcon = (props) => (
    <Icon as={FiChevronLeft} {...props} />
);
export const ChevronRightIcon = (props) => (
    <Icon as={FiChevronRight} {...props} />
);
export const ChevronUpIcon = (props) => <Icon as={FiChevronUp} {...props} />;
export const CloseIcon = (props) => <Icon as={FiX} {...props} />;
export const CopyIcon = (props) => <Icon as={FiCopy} {...props} />;
export const DeleteIcon = (props) => <Icon as={FiTrash2} {...props} />;
export const DownloadIcon = (props) => <Icon as={FiDownload} {...props} />;
export const EditIcon = (props) => <Icon as={FiEdit2} {...props} />;
export const ExternalLinkIcon = (props) => (
    <Icon as={FiExternalLink} {...props} />
);
export const InfoIcon = (props) => <Icon as={FiInfo} {...props} />;
export const MinusIcon = (props) => <Icon as={FiMinus} {...props} />;
export const QuestionIcon = (props) => <Icon as={FiHelpCircle} {...props} />;
export const RepeatIcon = (props) => <Icon as={FiRefreshCw} {...props} />;
export const SearchIcon = (props) => <Icon as={FiSearch} {...props} />;
export const SettingsIcon = (props) => <Icon as={FiSettings} {...props} />;
export const WarningIcon = (props) => <Icon as={FiAlertTriangle} {...props} />;
export const WarningTwoIcon = (props) => (
    <Icon as={BsExclamationTriangleFill} {...props} />
);
