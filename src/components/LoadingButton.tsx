import { Box, Button, ButtonProps } from "@looker/components";
import React from "react";
import styled, { keyframes } from "styled-components";

const progressAnimation = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`;

const ProgressBar = styled(Box)`
  animation: ${progressAnimation} 1s linear infinite;
  background: #5c5c5c;
  height: 2px;
  width: 100%;
  position: absolute;
  left: 0;
  bottom: 0;
`;

interface LoadingButtonProps extends ButtonProps {
  is_loading: boolean;
  flexGrow?: boolean;
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
  is_loading,
  flexGrow,
  children,
  ...button_props
}) => (
  <Box position="relative" width={flexGrow ? "100%" : undefined}>
    <Button {...button_props} width={flexGrow ? "100%" : undefined} disabled={is_loading || button_props.disabled}>
      {children}
    </Button>
    {is_loading && <ProgressBar />}
  </Box>
);

export default LoadingButton; 