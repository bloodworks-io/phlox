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

export const AddIcon = (props) => <Icon {...props} asChild><FiPlus /></Icon>;
export const ArrowUpIcon = (props) => <Icon {...props} asChild><FiArrowUp /></Icon>;
export const AttachmentIcon = (props) => <Icon {...props} asChild><FiPaperclip /></Icon>;
export const ChatIcon = (props) => <Icon {...props} asChild><FiMessageSquare /></Icon>;
export const CheckCircleIcon = (props) => (
    <Icon {...props} asChild><FiCheckCircle /></Icon>
);
export const CheckIcon = (props) => <Icon {...props} asChild><FiCheck /></Icon>;
export const ChevronDownIcon = (props) => (
    <Icon {...props} asChild><FiChevronDown /></Icon>
);
export const ChevronLeftIcon = (props) => (
    <Icon {...props} asChild><FiChevronLeft /></Icon>
);
export const ChevronRightIcon = (props) => (
    <Icon {...props} asChild><FiChevronRight /></Icon>
);
export const ChevronUpIcon = (props) => <Icon {...props} asChild><FiChevronUp /></Icon>;
export const CloseIcon = (props) => <Icon {...props} asChild><FiX /></Icon>;
export const CopyIcon = (props) => <Icon {...props} asChild><FiCopy /></Icon>;
export const DeleteIcon = (props) => <Icon {...props} asChild><FiTrash2 /></Icon>;
export const DownloadIcon = (props) => <Icon {...props} asChild><FiDownload /></Icon>;
export const EditIcon = (props) => <Icon {...props} asChild><FiEdit2 /></Icon>;
export const ExternalLinkIcon = (props) => (
    <Icon {...props} asChild><FiExternalLink /></Icon>
);
export const InfoIcon = (props) => <Icon {...props} asChild><FiInfo /></Icon>;
export const MinusIcon = (props) => <Icon {...props} asChild><FiMinus /></Icon>;
export const QuestionIcon = (props) => <Icon {...props} asChild><FiHelpCircle /></Icon>;
export const RepeatIcon = (props) => <Icon {...props} asChild><FiRefreshCw /></Icon>;
export const SearchIcon = (props) => <Icon {...props} asChild><FiSearch /></Icon>;
export const SettingsIcon = (props) => <Icon {...props} asChild><FiSettings /></Icon>;
export const WarningIcon = (props) => <Icon {...props} asChild><FiAlertTriangle /></Icon>;
export const WarningTwoIcon = (props) => (
    <Icon {...props} asChild><BsExclamationTriangleFill /></Icon>
);
