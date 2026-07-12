import ReactDOM from "react-dom/client";
import { Provider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";
import { BrowserRouter as Router } from "react-router";
import App from "./App";
import "./index.css";

import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto/400-italic.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";

import { ServerConnectionCheck } from "./components/common/ServerConnectionCheck";

(function () {
  try {
    const stored = localStorage.getItem("theme");
    const mode =
      stored ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    document.documentElement.classList.add(mode);
    if (!stored) localStorage.setItem("theme", mode);
  } catch (e) {
    // ignore
  }
})();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <Provider>
    <Router>
      <ServerConnectionCheck>
        <App />
      </ServerConnectionCheck>
    </Router>
    <Toaster />
  </Provider>,
);
