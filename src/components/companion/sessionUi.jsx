import { Spinner } from "@chakra-ui/react";
import { CheckIcon, WarningIcon } from "../common/icons";
import { FaRegClock } from "react-icons/fa";

// Shared presentation for companion session rows: the status icon and the
// one-line detail string used by the settings tab and the import modal.

export const SessionStatusIcon = ({ status }) => {
    if (status === "processing") return <Spinner size="xs" />;
    if (status === "imported") return <CheckIcon color="successButton" boxSize={3} />;
    if (status === "received") return <FaRegClock color="brand" boxSize={3} />;
    return <WarningIcon color="dangerButton" boxSize={3} />;
};

export const formatDuration = (startedAt, endedAt) => {
    if (!startedAt || !endedAt) return null;
    const seconds = Math.max(0, (new Date(endedAt) - new Date(startedAt)) / 1000);
    const mins = Math.round(seconds / 60);
    if (mins < 1) return "under a minute";
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const rest = mins % 60;
    return rest > 0 ? `${hours} hr ${rest} min` : `${hours} hr`;
};

/// "9:56 am" — the time a consultation started, locale-aware.
export const sessionTime = (session) => {
    const stamp = session.started_at || session.received_at;
    if (!stamp) return null;
    return new Date(stamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
    });
};

/// "Today" / "Yesterday" / "Friday 18 October" — for grouping and headers.
export const sessionDay = (session, t) => {
    const stamp = session.started_at || session.received_at;
    if (!stamp) return "";
    const date = new Date(stamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return t("settings.companion.today");
    if (date.toDateString() === yesterday.toDateString()) return t("settings.companion.yesterday");
    return date.toLocaleDateString([], {
        weekday: "long",
        day: "numeric",
        month: "long",
    });
};

export const sessionDetails = (session, t) =>
    [sessionTime(session), formatDuration(session.started_at, session.ended_at)]
        .filter(Boolean)
        .join(" · ");
