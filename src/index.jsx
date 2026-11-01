import ReactDOM from "react-dom/client";
import { Provider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";
import { BrowserRouter as Router } from "react-router";
import { SWRConfig } from "swr";
import App from "./App";
import "./i18n";
import "./index.css";

import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto/400-italic.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";
import "@fontsource/source-serif-4/500.css";

import { ServerConnectionCheck } from "./components/common/ServerConnectionCheck";

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
