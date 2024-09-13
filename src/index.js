// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import { ChakraProvider, ColorModeScript } from "@chakra-ui/react";
import { BrowserRouter as Router } from "react-router-dom";
import App from "./App";
import "./index.css";
import theme from "./theme";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ChakraProvider theme={theme}>
    <ColorModeScript initialColorMode={theme.config.initialColorMode} />
    <Router>
      <App />
    </Router>
  </ChakraProvider>,
);

export default App;
