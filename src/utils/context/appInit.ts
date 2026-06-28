import { createContext, useContext } from "react";

// Context to track if app is initializing (server not ready yet)
export const AppInitContext = createContext({
    isInitializing: false,
});

export const useAppInit = () => useContext(AppInitContext);
