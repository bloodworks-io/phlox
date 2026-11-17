(function () {
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');
    let preference = "system";

    try {
        const storedPreference = window.localStorage.getItem("theme");
        if (
            storedPreference === "light" ||
            storedPreference === "dark" ||
            storedPreference === "system"
        ) {
            preference = storedPreference;
        }
    } catch {
        preference = "system";
    }

    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    const effectiveTheme =
        preference === "system" ? systemTheme : preference;
    const canvas = effectiveTheme === "dark" ? "#262b25" : "#f3f0e9";

    root.classList.remove("light", "dark");
    root.classList.add(effectiveTheme);
    root.dataset.themePreference = preference;
    root.dataset.effectiveTheme = effectiveTheme;
    root.style.colorScheme = effectiveTheme;
    root.style.background = canvas;

    if (meta) {
        meta.setAttribute("content", canvas);
    }
})();
