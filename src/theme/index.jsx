// Entry point for the Chakra UI theme, combining all theme configurations.
import { extendTheme } from "@chakra-ui/react";
import { config } from "./config";
import { colors } from "./colors";
import { typography } from "./typography";
import { styles } from "./styles"; // Import from the index.js in the styles directory
import { components } from "./components";

const theme = extendTheme({ config, colors, typography, styles, components });

export default theme;
