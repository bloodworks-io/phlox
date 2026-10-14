import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Box, Popover, Text } from "@chakra-ui/react";
import TextareaAutosize from "react-textarea-autosize";
import { FaCheck } from "react-icons/fa";
import { Tooltip } from "@/components/ui/tooltip";
import { useColorModeValue } from "@/components/ui/color-mode";
import { SpeakerDot, parseSpeakerLine } from "../transcript/SpeakerText";
import { activeCitations, matchCitationsToLines } from "../../utils/patient/citationMatching";
import type { LineCitation } from "../../utils/patient/types";

const MIRROR_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  visibility: "hidden",
  pointerEvents: "none",
  whiteSpace: "pre-wrap",
  overflowWrap: "break-word",
  fontSize: "1rem",
  lineHeight: 1.5,
  fontWeight: 400,
  fontFamily: "inherit",
};

const GUTTER_PX = 28;
// Gap between a line's last character and its badge.
const BADGE_GAP_PX = 6;

// One dot language for all verdicts: filled sage (supported — deliberately
// quiet), hollow amber (unverified — mirrors SpeakerDot's hollow S?
// convention), haloed red (conflict). Shape differs so colour is never the
// only cue; rest opacity per verdict lives in the theme.
const VERDICT_COLORS: Record<LineCitation["verdict"], [string, string]> = {
  supported: ["#7fae7f", "#76a376"],
  unverified: ["#df8e1d", "#eed49f"],
  conflict: ["#d20f39", "#ed8796"],
};

const VerdictDot = ({ verdict }: { verdict: LineCitation["verdict"] }) => {
  const [light, dark] = VERDICT_COLORS[verdict];
  const color = useColorModeValue(light, dark);
  return (
    <span
      style={{
        display: "inline-block",
        width: "6px",
        height: "6px",
        borderRadius: "9999px",
        backgroundColor: verdict === "unverified" ? "transparent" : color,
        border: verdict === "unverified" ? `1.5px solid ${color}` : "none",
        boxSizing: "border-box",
      }}
      data-verdict-dot={verdict}
    />
  );
};

interface GroundedTextareaProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  textareaRef?: (element: HTMLTextAreaElement | null) => void;
  fieldKey: string;
  /** Present only when grounding is active for this field (guard passed by caller). */
  citations?: LineCitation[];
  rawTranscription?: string | null;
  resolved?: string[];
  onDismiss?: (fieldKey: string, lineIndex: number) => void;
  onCiteLine?: (lineIndex: number) => void;
}

interface AnchorPoint {
  top: number;
  left: number;
}

interface Anchors {
  [lineIndex: number]: AnchorPoint | undefined;
}

const sameAnchors = (a: Anchors, b: Anchors) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.entries(a).every(
    ([key, value]) =>
      b[Number(key)]?.top === value?.top && b[Number(key)]?.left === value?.left,
  );

const UtteranceRow = ({
  text,
  line,
  onCiteLine,
}: {
  text: string;
  line: number;
  onCiteLine?: (lineIndex: number) => void;
}) => {
  const { t } = useTranslation();
  const { speaker, text: body } = parseSpeakerLine(text);
  return (
    <Text
      as="div"
      fontSize="sm"
      whiteSpace="pre-wrap"
      borderBottomWidth="1px"
      borderColor="surface"
      py={1}
      cursor={onCiteLine ? "pointer" : undefined}
      _hover={onCiteLine ? { bg: "surface" } : undefined}
      onClick={() => onCiteLine?.(line)}
      title={onCiteLine ? t("patient.citationGoToLine") : undefined}
    >
      <Text as="span" color="overlay0" fontSize="xs" mr={2}>
        [{line}]
      </Text>
      {speaker ? <SpeakerDot speaker={speaker} /> : null}
      {body}
    </Text>
  );
};

const GroundedTextarea = ({
  value,
  onChange,
  placeholder,
  className,
  textareaRef,
  fieldKey,
  citations,
  rawTranscription,
  resolved = [],
  onDismiss,
  onCiteLine,
}: GroundedTextareaProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  // Measured in effects (ref reads are illegal during render): per-line
  // badge anchors plus the horizontal clamp for full-width lines.
  const [layout, setLayout] = useState<{ anchors: Anchors; maxLeft: number }>({
    anchors: {},
    maxLeft: 0,
  });

  const overlayActive = Boolean(citations && citations.length > 0);

  const measure = useCallback(() => {
    const mirror = mirrorRef.current;
    const root = rootRef.current;
    if (!mirror || !root) return;
    const next: Anchors = {};
    mirror.querySelectorAll<HTMLElement>("[data-line-end]").forEach((marker) => {
      next[Number(marker.dataset.lineEnd)] = {
        top: marker.offsetTop,
        left: marker.offsetLeft,
      };
    });
    const nextMaxLeft = root.clientWidth - 16;
    setLayout((prev) =>
      sameAnchors(prev.anchors, next) && prev.maxLeft === nextMaxLeft
        ? prev
        : { anchors: next, maxLeft: nextMaxLeft },
    );
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [value, overlayActive, measure]);

  useEffect(() => {
    const textarea = rootRef.current?.querySelector("textarea");
    if (!textarea || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => measure());
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [measure]);

  const matched = overlayActive
    ? matchCitationsToLines(value, activeCitations(fieldKey, citations ?? [], resolved))
    : [];

  return (
    <Box
      ref={rootRef}
      position="relative"
      pr={overlayActive ? `${GUTTER_PX}px` : undefined}
    >
      <TextareaAutosize
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={className}
        style={{ width: "100%" }}
        ref={textareaRef}
      />
      {overlayActive && (
        <div
          ref={mirrorRef}
          aria-hidden="true"
          style={{ ...MIRROR_STYLE, right: `${GUTTER_PX}px` }}
        >
          {value.split("\n").map((line, index) => (
            <span key={index} data-line={index}>
              {line}
              {/* Zero-size marker lands exactly after the last character,
                  on the line's final visual row — the badge anchor. */}
              <span data-line-end={index} />
              {"\n"}
            </span>
          ))}
        </div>
      )}
      {overlayActive &&
        matched.map(({ citation, anchorLineIndex }) => {
          // Tight to the text: badge sits just past the line's last
          // character; full-width lines clamp into the right gutter shelf.
          const anchor = layout.anchors[anchorLineIndex];
          return (
            <CitationBadge
              key={`${fieldKey}-${citation.line_index}`}
              citation={citation}
              top={anchor?.top ?? 0}
              left={Math.min((anchor?.left ?? 0) + BADGE_GAP_PX, layout.maxLeft)}
              rawTranscription={rawTranscription}
              onCiteLine={onCiteLine}
              onDismiss={onDismiss}
              fieldKey={fieldKey}
            />
          );
        })}
    </Box>
  );
};

const CitationBadge = ({
  citation,
  top,
  left,
  rawTranscription,
  onCiteLine,
  onDismiss,
  fieldKey,
}: {
  citation: LineCitation;
  top: number;
  left: number;
  rawTranscription?: string | null;
  onCiteLine?: (lineIndex: number) => void;
  onDismiss?: (fieldKey: string, lineIndex: number) => void;
  fieldKey: string;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const transcriptLines = (rawTranscription ?? "").split("\n");

  const utterances = (indices: number[]) =>
     indices.filter((index) => index >= 0 && index < transcriptLines.length);

  const label = t(
    citation.verdict === "supported"
      ? "patient.citationSupportedLabel"
      : citation.verdict === "conflict"
        ? "patient.citationConflict"
        : "patient.citationUnverified",
    citation.verdict === "supported"
      ? { count: citation.sources.length }
      : undefined,
  );

  return (
    <Popover.Root
      open={open}
      onOpenChange={(details) => setOpen(details.open)}
      positioning={{ placement: "left" }}
    >
      <Popover.Trigger asChild>
        <Box
          as="button"
          position="absolute"
          left={`${left}px`}
          top={`${top}px`}
          height="16px"
          minWidth="16px"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          padding="0"
          className={`citation-badge${
            citation.verdict === "conflict" ? " citation-badge--conflict" : ""
          }`}
          data-verdict={citation.verdict}
          aria-label={label}
        >
          <Tooltip
            content={label}
            showArrow
            disabled={open}
            positioning={{ placement: "top" }}
          >
            <Box as="span" display="inline-flex" lineHeight="0">
              <VerdictDot verdict={citation.verdict} />
            </Box>
          </Tooltip>
        </Box>
      </Popover.Trigger>
      <Popover.Positioner>
        <Popover.Content maxW="380px" w="380px">
          <Popover.Arrow>
            <Popover.ArrowTip />
          </Popover.Arrow>
          <Popover.Header
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gap={2}
            fontSize="sm"
            fontWeight="600"
          >
            <Text as="span" truncate>
              {label}
            </Text>
          </Popover.Header>
          <Popover.Body>
            {citation.verdict === "unverified" && (
              <Text fontSize="sm" whiteSpace="pre-wrap" mb={1}>
                {citation.text}
              </Text>
            )}
            {citation.verdict === "supported" &&
              utterances(citation.sources).map((line) => (
                <UtteranceRow
                  key={line}
                  text={transcriptLines[line]}
                  line={line}
                  onCiteLine={onCiteLine}
                />
              ))}
            {citation.verdict === "conflict" && (
              <>
                <Text fontSize="xs" color="overlay0" mb={1}>
                  {t("patient.citationContradictsLine")}
                </Text>
                {utterances(citation.contradicts).map((line) => (
                  <UtteranceRow
                    key={line}
                    text={transcriptLines[line]}
                    line={line}
                    onCiteLine={onCiteLine}
                  />
                ))}
              </>
            )}
            {citation.verdict !== "supported" && onDismiss && (
              <Box
                as="button"
                mt={2}
                display="inline-flex"
                alignItems="center"
                gap={1}
                fontSize="sm"
                color="primaryButton"
                background="none"
                border="none"
                cursor="pointer"
                onClick={() => {
                  setOpen(false);
                  onDismiss(fieldKey, citation.line_index);
                }}
              >
                <FaCheck size="10px" />
                {t("patient.citationKeep")}
              </Box>
            )}
          </Popover.Body>
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Root>
  );
};

export default GroundedTextarea;
