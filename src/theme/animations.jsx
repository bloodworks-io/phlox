import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import { Box, HStack } from "@chakra-ui/react";

export const emergeFromButton = keyframes`
  from {
    transform: scale(0.8) translateX(20px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateX(0);
    opacity: 1;
  }
`;

export const loadingGradient = keyframes`
     0% { background-position: 0% 50%; }
     50% { background-position: 100% 50%; }
     100% { background-position: 0% 50%; }
   `;

export const slideUp = keyframes`
     from {
       transform: translateY(20px);
       opacity: 0;
     }
     to {
       transform: translateY(0);
       opacity: 1;
     }
   `;

export const AnimatedChatPanel = styled(Box)`
  animation: ${emergeFromButton} 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)
    forwards;
  transform-origin: bottom right;
`;

export const AnimatedHStack = styled(HStack)`
  animation: ${slideUp} 0.5s ease-out forwards;
`;

export const LoadingBox = styled(Box)`
  position: relative;
  overflow: hidden;
  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.4) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    animation: ${loadingGradient} 1.5s ease-in-out infinite;
    background-size: 200% 100%;
  }
`;
