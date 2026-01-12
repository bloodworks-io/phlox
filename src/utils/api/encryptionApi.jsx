import { invoke } from "@tauri-apps/api/core";

/**
 * Encryption API for Tauri commands
 * Handles key wrapping, passphrase setup, and keychain operations
 */
export const encryptionApi = {
  /**
   * Check if encryption has been set up (wrapped_key.bin exists)
   */
  hasSetup: async () => {
    try {
      return await invoke("has_encryption_setup");
    } catch (error) {
      console.error("Error checking encryption setup:", error);
      return false;
    }
  },

  /**
   * Check if database file exists
   */
  hasDatabase: async () => {
    try {
      return await invoke("has_database");
    } catch (error) {
      console.error("Error checking database:", error);
      return false;
    }
  },

  /**
   * Check if master key is cached in keychain
   */
  hasKeychain: async () => {
    try {
      return await invoke("has_keychain_entry");
    } catch (error) {
      console.error("Error checking keychain:", error);
      return false;
    }
  },

  /**
   * Get complete encryption status
   */
  getStatus: async () => {
    try {
      return await invoke("get_encryption_status");
    } catch (error) {
      console.error("Error getting encryption status:", error);
      return {
        has_setup: false,
        has_database: false,
        has_keychain: false,
      };
    }
  },

  /**
   * Set up encryption with a new passphrase
   * @param {string} passphrase - User's passphrase (min 12 characters)
   */
  setup: async (passphrase) => {
    return await invoke("setup_encryption", { passphrase });
  },

  /**
   * Unlock with passphrase and cache in keychain
   * @param {string} passphrase - User's passphrase
   */
  unlock: async (passphrase) => {
    return await invoke("unlock_with_passphrase", { passphrase });
  },

  /**
   * Change passphrase (not yet implemented)
   */
  changePassphrase: async (oldPassphrase, newPassphrase) => {
    return await invoke("change_passphrase", {
      oldPassphrase: oldPassphrase,
      newPassphrase: newPassphrase,
    });
  },

  /**
   * Clear key from keychain (for testing/logout)
   */
  clearKeychain: async () => {
    return await invoke("clear_keychain");
  },
};

/**
 * Calculate passphrase strength
 * @param {string} passphrase
 * @returns {object} - { score: 0-4, feedback: string }
 */
export const calculatePassphraseStrength = (passphrase) => {
  let score = 0;
  const feedback = [];

  if (passphrase.length >= 12) score += 1;
  else feedback.push("Use at least 12 characters");

  if (passphrase.length >= 16) score += 1;
  else if (passphrase.length >= 12) feedback.push("16+ characters is better");

  if (/[a-z]/.test(passphrase) && /[A-Z]/.test(passphrase)) score += 1;
  else feedback.push("Mix uppercase and lowercase");

  if (/\d/.test(passphrase)) score += 1;
  else feedback.push("Add numbers");

  if (/[^a-zA-Z0-9]/.test(passphrase)) score += 1;
  else feedback.push("Add special characters");

  // Cap at 4
  const finalScore = Math.min(score, 4);

  let strength = "Weak";
  if (finalScore >= 4) strength = "Strong";
  else if (finalScore >= 3) strength = "Good";
  else if (finalScore >= 2) strength = "Fair";

  return {
    score: finalScore,
    strength,
    feedback: feedback.length > 0 ? feedback : ["Looks good!"],
  };
};
