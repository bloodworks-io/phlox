"use client"

import type { IconButtonProps, SpanProps } from "@chakra-ui/react"
import { ClientOnly, IconButton, Skeleton, Span } from "@chakra-ui/react"
import { invoke } from "@tauri-apps/api/core"
import { ThemeProvider, useTheme } from "next-themes"
import type { ThemeProviderProps } from "next-themes"
import * as React from "react"
import { LuMoon, LuSun } from "react-icons/lu"
import { isTauri } from "@/utils/helpers/apiConfig"

export interface ColorModeProviderProps extends ThemeProviderProps {}

export type ColorMode = "light" | "dark"
export type ThemePreference = "light" | "dark" | "system"

const normalizeThemePreference = (value: string | undefined): ThemePreference => {
  if (value === "light" || value === "dark" || value === "system") {
    return value
  }
  return "system"
}

const applyEffectiveTheme = (
  preference: ThemePreference,
  effectiveTheme: ColorMode,
) => {
  const root = document.documentElement
  const canvas = effectiveTheme === "dark" ? "#262b25" : "#f3f0e9"
  const meta = document.querySelector('meta[name="theme-color"]')

  root.classList.remove("light", "dark")
  root.classList.add(effectiveTheme)
  root.dataset.themePreference = preference
  root.dataset.effectiveTheme = effectiveTheme
  root.style.colorScheme = effectiveTheme
  root.style.background = canvas

  if (meta) {
    meta.setAttribute("content", canvas)
  }
}

const EffectiveThemeCoordinator = () => {
  const { theme, resolvedTheme } = useTheme()
  const preference = normalizeThemePreference(theme)
  const effectiveTheme: ColorMode = resolvedTheme === "dark" ? "dark" : "light"
  const revealedWindowRef = React.useRef(false)

  React.useEffect(() => {
    applyEffectiveTheme(preference, effectiveTheme)

    if (!isTauri()) {
      return
    }

    let cancelled = false

    const synchronizeNativeTheme = async () => {
      try {
        await invoke("set_window_appearance", {
          preference,
          effective: effectiveTheme,
        })
      } catch (error) {
        console.error("Failed to synchronize native theme:", error)
      }

      if (cancelled || revealedWindowRef.current) {
        return
      }

      revealedWindowRef.current = true
      try {
        await invoke("reveal_main_window")
      } catch (error) {
        console.error("Failed to reveal main window:", error)
      }
    }

    void synchronizeNativeTheme()

    return () => {
      cancelled = true
    }
  }, [preference, effectiveTheme])

  return null
}

export function ColorModeProvider({
  children,
  ...props
}: ColorModeProviderProps) {
  return (
    <ThemeProvider
      attribute="class"
      disableTransitionOnChange
      defaultTheme="system"
      enableSystem
      {...props}
    >
      <EffectiveThemeCoordinator />
      {children}
    </ThemeProvider>
  )
}

export interface UseColorModeReturn {
  colorMode: ColorMode
  setColorMode: (colorMode: ColorMode) => void
  toggleColorMode: () => void
}

export function useColorMode(): UseColorModeReturn {
  const { resolvedTheme, setTheme, forcedTheme } = useTheme()
  const colorMode = forcedTheme || resolvedTheme
  const toggleColorMode = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }
  return {
    colorMode: colorMode as ColorMode,
    setColorMode: setTheme,
    toggleColorMode,
  }
}

export interface UseThemePreferenceReturn {
  themePreference: ThemePreference
  setThemePreference: (preference: ThemePreference) => void
}

export function useThemePreference(): UseThemePreferenceReturn {
  const { theme, setTheme } = useTheme()
  return {
    themePreference: normalizeThemePreference(theme),
    setThemePreference: setTheme,
  }
}

export function useColorModeValue<T>(light: T, dark: T) {
  const { colorMode } = useColorMode()
  return colorMode === "dark" ? dark : light
}

export function ColorModeIcon() {
  const { colorMode } = useColorMode()
  return colorMode === "dark" ? <LuMoon /> : <LuSun />
}

interface ColorModeButtonProps extends Omit<IconButtonProps, "aria-label"> {}

export const ColorModeButton = React.forwardRef<
  HTMLButtonElement,
  ColorModeButtonProps
>(function ColorModeButton(props, ref) {
  const { toggleColorMode } = useColorMode()
  return (
    <ClientOnly fallback={<Skeleton boxSize="9" />}>
      <IconButton
        onClick={toggleColorMode}
        variant="ghost"
        aria-label="Toggle color mode"
        size="sm"
        ref={ref}
        {...props}
        css={{
          _icon: {
            width: "5",
            height: "5",
          },
        }}
      >
        <ColorModeIcon />
      </IconButton>
    </ClientOnly>
  )
})

export const LightMode = React.forwardRef<HTMLSpanElement, SpanProps>(
  function LightMode(props, ref) {
    return (
      <Span
        color="fg"
        display="contents"
        className="chakra-theme light"
        colorPalette="light"
        ref={ref}
        {...props}
      />
    );
  },
)

export const DarkMode = React.forwardRef<HTMLSpanElement, SpanProps>(
  function DarkMode(props, ref) {
    return (
      <Span
        color="fg"
        display="contents"
        className="chakra-theme dark"
        colorPalette="dark"
        ref={ref}
        {...props}
      />
    );
  },
)
