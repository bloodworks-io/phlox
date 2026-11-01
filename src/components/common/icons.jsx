// Local icon wrappers.

import { Icon } from "@chakra-ui/react";
import {
    LuArrowUp,
    LuCheck,
    LuChevronDown,
    LuChevronLeft,
    LuChevronRight,
    LuChevronUp,
    LuCircleCheck,
    LuCircleHelp,
    LuCopy,
    LuDownload,
    LuExternalLink,
    LuInfo,
    LuMessageSquare,
    LuMinus,
    LuPaperclip,
    LuPencil,
    LuPlus,
    LuRefreshCw,
    LuSearch,
    LuSettings,
    LuTrash2,
    LuTriangleAlert,
    LuX,
} from "react-icons/lu";

export const AddIcon = (props) => <Icon {...props} asChild><LuPlus strokeWidth={1.6} /></Icon>;
export const ArrowUpIcon = (props) => <Icon {...props} asChild><LuArrowUp strokeWidth={1.6} /></Icon>;
export const AttachmentIcon = (props) => <Icon {...props} asChild><LuPaperclip strokeWidth={1.6} /></Icon>;
export const ChatIcon = (props) => <Icon {...props} asChild><LuMessageSquare strokeWidth={1.6} /></Icon>;
export const CheckCircleIcon = (props) => (
    <Icon {...props} asChild><LuCircleCheck strokeWidth={1.6} /></Icon>
);
export const CheckIcon = (props) => <Icon {...props} asChild><LuCheck strokeWidth={1.6} /></Icon>;
export const ChevronDownIcon = (props) => (
    <Icon {...props} asChild><LuChevronDown strokeWidth={1.6} /></Icon>
);
export const ChevronLeftIcon = (props) => (
    <Icon {...props} asChild><LuChevronLeft strokeWidth={1.6} /></Icon>
);
export const ChevronRightIcon = (props) => (
    <Icon {...props} asChild><LuChevronRight strokeWidth={1.6} /></Icon>
);
export const ChevronUpIcon = (props) => <Icon {...props} asChild><LuChevronUp strokeWidth={1.6} /></Icon>;
export const CloseIcon = (props) => <Icon {...props} asChild><LuX strokeWidth={1.6} /></Icon>;
export const CopyIcon = (props) => <Icon {...props} asChild><LuCopy strokeWidth={1.6} /></Icon>;
export const DeleteIcon = (props) => <Icon {...props} asChild><LuTrash2 strokeWidth={1.6} /></Icon>;
export const DownloadIcon = (props) => <Icon {...props} asChild><LuDownload strokeWidth={1.6} /></Icon>;
export const EditIcon = (props) => <Icon {...props} asChild><LuPencil strokeWidth={1.6} /></Icon>;
export const ExternalLinkIcon = (props) => (
    <Icon {...props} asChild><LuExternalLink strokeWidth={1.6} /></Icon>
);
export const InfoIcon = (props) => <Icon {...props} asChild><LuInfo strokeWidth={1.6} /></Icon>;
export const MinusIcon = (props) => <Icon {...props} asChild><LuMinus strokeWidth={1.6} /></Icon>;
export const QuestionIcon = (props) => <Icon {...props} asChild><LuCircleHelp strokeWidth={1.6} /></Icon>;
export const RepeatIcon = (props) => <Icon {...props} asChild><LuRefreshCw strokeWidth={1.6} /></Icon>;
export const SearchIcon = (props) => <Icon {...props} asChild><LuSearch strokeWidth={1.6} /></Icon>;
export const SettingsIcon = (props) => <Icon {...props} asChild><LuSettings strokeWidth={1.6} /></Icon>;
export const WarningIcon = (props) => <Icon {...props} asChild><LuTriangleAlert strokeWidth={1.6} /></Icon>;
export const WarningTwoIcon = (props) => (
    <Icon {...props} asChild><LuTriangleAlert strokeWidth={1.6} /></Icon>
);
