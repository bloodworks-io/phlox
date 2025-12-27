import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
} from "react";
import { useClipboard, Box } from "@chakra-ui/react";
import styled from "@emotion/styled";
import { keyframes } from "@emotion/react";

import LetterPanel from "./letter/LetterPanel";
import { useLetterTemplates } from "../../utils/hooks/useLetterTemplates";
import { emergeFromButton } from "../../theme/animations";

const AnimatedBox = styled(Box)`
  animation: ${emergeFromButton} 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)
    forwards;
  transform-origin: bottom right;
`;

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
        // Use isOpen prop
        setTimeout(() => {
          autoResizeTextarea();
        }, 100); // Small delay for elements to render
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
      // Call the onClose prop passed from parent
      if (onClose) {
        onClose();
      }
    };

    // Imperative handle for parent components to call methods
    useImperativeHandle(ref, () => ({
      autoResizeTextarea,
    }));

    if (!isOpen) {
      // If not open, render nothing
      return null;
    }

    return (
      <AnimatedBox
        position="fixed" // Or 'absolute' if relative to a specific parent in PatientDetails DOM
        bottom="20px" // Adjust based on FAM size and spacing
        right="75px" // Adjust based on FAM position
        zIndex="1000" // Below FAM menu, but above other content
        // className="hover-letter-box" // Keep if used for other global styles
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
      </AnimatedBox>
    );
  },
);

export default Letter;
