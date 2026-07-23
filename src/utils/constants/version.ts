// Version is injected at build time by Vite
/* global __APP_VERSION__ */
export const APP_VERSION =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
