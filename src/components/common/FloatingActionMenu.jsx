import React, { useState, useRef } from "react";
import { Box, IconButton, Tooltip, useOutsideClick } from "@chakra-ui/react";
import { AddIcon, CloseIcon, ChatIcon } from "@chakra-ui/icons";
import { FaEnvelope } from "react-icons/fa";
import styled from "@emotion/styled";
import { keyframes } from "@emotion/react";
import { isChatEnabled } from "../../utils/helpers/featureFlags";

// Updated animation to move vertically upward
const revealAnimation = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const ActionButtonWrapper = styled(Box)`
  animation: ${revealAnimation} 0.3s ease-out forwards;
  margin-bottom: 10px;
`;

const FloatingActionMenu = ({
  onOpenChat,
  onOpenLetter,
  isChatOpen,
  isLetterOpen,
  onMenuOpen,
  onMenuClose,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef();

  // Inform parent component when menu state changes
  const updateMenuState = (newState) => {
    setIsMenuOpen(newState);
    if (newState) {
      if (onMenuOpen) onMenuOpen();
    } else {
      if (onMenuClose) onMenuClose();
    }
  };

  useOutsideClick({
    ref: menuRef,
    handler: () => {
      // Only close menu if neither panel is open
      if (isMenuOpen && !isChatOpen && !isLetterOpen) {
        updateMenuState(false);
      }
    },
  });

  const toggleMenu = (e) => {
    e.stopPropagation();
    updateMenuState(!isMenuOpen);
  };

  // Update menu state when panels open/close
  React.useEffect(() => {
    // only force-open if we aren't already open
    if ((isChatOpen || isLetterOpen) && !isMenuOpen) {
      setIsMenuOpen(true);
    }
  }, [isChatOpen, isLetterOpen, isMenuOpen]);

  const mainFabIcon = isMenuOpen ? <CloseIcon /> : <AddIcon />;

  return (
    <Box
      position="fixed"
      bottom="20px"
      right="20px"
      zIndex="1050"
      ref={menuRef}
    >
      {/* Action buttons positioned above the main button */}
      {isMenuOpen && (
        <Box position="absolute" bottom="50px" right="5px">
          <Box display="flex" flexDirection="column" alignItems="flex-end">
            {isChatEnabled() && (
              <ActionButtonWrapper>
                <Tooltip label="Open Chat with Phlox" placement="left">
                  <IconButton
                    icon={<ChatIcon />}
                    onClick={onOpenChat}
                    aria-label="Open Chat"
                    className="fam-action-button chat-fam-button"
                    size="md"
                    isRound
                  />
                </Tooltip>
              </ActionButtonWrapper>
            )}
            <ActionButtonWrapper>
              <Tooltip label="Open Patient Letter" placement="left">
                <IconButton
                  icon={<FaEnvelope />}
                  onClick={onOpenLetter}
                  aria-label="Open Letter"
                  className="fam-action-button letter-fam-button"
                  size="md"
                  isRound
                />
              </Tooltip>
            </ActionButtonWrapper>
          </Box>
        </Box>
      )}

      {/* Main button always stays at the bottom right */}
      <Tooltip
        label={isMenuOpen ? "Close Menu" : "Open Actions Menu"}
        placement="left"
      >
        <IconButton
          icon={mainFabIcon}
          onClick={toggleMenu}
          aria-label="Toggle Actions Menu"
          size="lg"
          isRound
          className="fam-main-button"
          boxShadow="xl"
        />
      </Tooltip>
    </Box>
  );
};

export default FloatingActionMenu;
