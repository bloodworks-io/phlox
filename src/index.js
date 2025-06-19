import React from "react";
import ReactDOM from "react-dom/client";
import { ChakraProvider, ColorModeScript } from "@chakra-ui/react";
import { BrowserRouter as Router } from "react-router-dom";
import App from "./App";
import "./index.css";
import theme from "./theme";
import { CustomToast } from "./components/common/Toast";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ChakraProvider
    theme={theme}
    toastOptions={{
      defaultOptions: {
        position: "bottom",
        render: CustomToast,
      },
    }}
  >
    <ColorModeScript initialColorMode={theme.config.initialColorMode} />
    <Router>
      <ServerConnectionCheck>
        <App />
      </ServerConnectionCheck>
    </Router>
  </ChakraProvider>,
);

export default App;
