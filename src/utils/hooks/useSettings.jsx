// Custom hook for managing application settings state.
import { useState, useEffect } from "react";
import { settingsService } from "../settings/ettingsUtils";

export const useSettings = () => {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const [userSettings, prompts, config, options] =
                    await Promise.all([
                        settingsService.fetchUserSettings(),
                        settingsService.fetchPrompts(),
                        settingsService.fetchConfig(),
                        settingsService.fetchOptions(),
                    ]);

                setSettings({ userSettings, prompts, config, options });
            } catch (err) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
    }, []);

    return { settings, loading, error };
};
