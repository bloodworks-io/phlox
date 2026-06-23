import ReactDOM from "react-dom/client";
import { Provider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";
import { BrowserRouter as Router } from "react-router-dom";
import App from "./App";
import "./index.css";
import { ServerConnectionCheck } from "./components/common/ServerConnectionCheck";

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
