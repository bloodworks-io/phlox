import ReactDOM from "react-dom/client";
import { Provider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";
import { BrowserRouter as Router } from "react-router";
import { SWRConfig } from "swr";
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

    localStorage.removeItem("theme");
    const mode = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(mode);
  } catch {
    // ignore
  }
})();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <Provider>
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateIfStale: false,
        shouldRetryOnError: true,
        dedupingInterval: 2000,
        errorRetryCount: 2,
      }}
    >
      <Router>
        <ServerConnectionCheck>
          <App />
        </ServerConnectionCheck>
      </Router>
    </SWRConfig>
    <Toaster />
  </Provider>,
);
