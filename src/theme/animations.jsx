import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import { Steps, HStack } from "@chakra-ui/react";

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

export const AnimatedHStack = styled(HStack)`
  animation: ${slideUp} 0.5s ease-out forwards;
`;
