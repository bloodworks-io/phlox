import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
} from "react";
import { useClipboard } from "@chakra-ui/react";

import LetterPanel from "./LetterPanel";
import { useLetterTemplates } from "../../../utils/hooks/useLetterTemplates";
import FloatingPanel from "../../common/FloatingPanel";

const Letter = forwardRef(
  (
    {
      isOpen,
      onClose,
      finalCorrespondence,
      setFinalCorrespondence,
      handleSaveLetter,
      loading,
      handleGenerateLetterClick,
      handleRefineLetter,
      setIsModified,
      toast,
      patient,
      setLoading: setGeneralLoading,
    },
    ref,
  ) => {
    // State
    const [isRefining, setIsRefining] = useState(false);
    const [refinementInput, setRefinementInput] = useState("");
    const [recentlyCopied, setRecentlyCopied] = useState(false);
    const [saveState, setSaveState] = useState("idle");
    const [dimensions, setDimensions] = useState({
      width: 650,
      height: 550,
    });

    // Refs
    const textareasRefs = useRef({});
    const saveTimerRef = useRef(null);
    const resizerRef = useRef(null);

    // Hooks
    const {
      letterTemplates,
      selectedTemplate,
      additionalInstructions,
      setAdditionalInstructions,
      options,
      selectTemplate,
      getInstructions,
    } = useLetterTemplates(patient?.id);

    const { onCopy } = useClipboard(
      finalCorrespondence || "No letter attached to encounter",
    );

    // Clear the save timer on unmount
    useEffect(() => {
      return () => {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
        }
      };
    }, []);

    // Functions
    const autoResizeTextarea = () => {
      const textarea = textareasRefs.current.letter;
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
      }
    };

    // Auto-resize when letter opens or content changes
    useEffect(() => {
      if (isOpen) {
        setTimeout(() => {
          autoResizeTextarea();
        }, 100);
      }
    }, [isOpen, finalCorrespondence]);

    const handleCopy = () => {
      onCopy();
      setRecentlyCopied(true);
      setTimeout(() => setRecentlyCopied(false), 2000);
    };

    const handleSave = async () => {
      setSaveState("saving");
      try {
        await handleSaveLetter();
        setSaveState("saved");
        saveTimerRef.current = setTimeout(() => setSaveState("idle"), 2000);
      } catch (error) {
        console.error("Error saving letter:", error);
        setSaveState("idle");
      }
    };

    const handleRefinement = async () => {
      if (!patient || !refinementInput.trim()) return;

      await handleRefineLetter({
        patient,
        additionalInstructions: getInstructions(),
        refinementInput,
        options,
        onSuccess: () => {
          setRefinementInput("");
          setIsRefining(false);
        },
      });
    };

    // Resize functionality
    const handleMouseDown = (e) => {
      e.preventDefault();
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    };

    const handleMouseMove = (e) => {
      setDimensions((prev) => ({
        width: Math.max(
          400,
          prev.width -
            (e.clientX - resizerRef.current.getBoundingClientRect().left),
        ),
        height: Math.max(
          300,
          prev.height -
            (e.clientY - resizerRef.current.getBoundingClientRect().top),
        ),
      }));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    const handleClose = () => {
      if (onClose) {
        onClose();
      }
    };

    // Imperative handle for parent components to call methods
    useImperativeHandle(ref, () => ({
      autoResizeTextarea,
    }));

    return (
      <FloatingPanel
        isOpen={isOpen}
        position="left-of-fab"
        showArrow={true}
        width={`${dimensions.width}px`}
        height={`${dimensions.height}px`}
        zIndex="1000"
      >
        <LetterPanel
          patient={patient}
          dimensions={dimensions}
          resizerRef={resizerRef}
          handleMouseDown={handleMouseDown}
          onClose={handleClose}
          finalCorrespondence={finalCorrespondence}
          setFinalCorrespondence={setFinalCorrespondence}
          letterLoading={loading}
          setLoading={setGeneralLoading}
          handleGenerateLetterClick={handleGenerateLetterClick}
          handleSaveLetter={handleSave}
          setIsModified={setIsModified}
          letterTemplates={letterTemplates}
          selectedTemplate={selectedTemplate}
          selectTemplate={selectTemplate}
          additionalInstructions={additionalInstructions}
          setAdditionalInstructions={setAdditionalInstructions}
          refinementInput={refinementInput}
          setRefinementInput={setRefinementInput}
          handleRefinement={handleRefinement}
          isRefining={isRefining}
          setIsRefining={setIsRefining}
          textareaRef={(el) => (textareasRefs.current.letter = el)}
          recentlyCopied={recentlyCopied}
          saveState={saveState}
          handleCopy={handleCopy}
        />
      </FloatingPanel>
    );
  },
);

export default Letter;
