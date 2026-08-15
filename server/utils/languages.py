"""Language code to human-readable name mapping.

Used when composing LLM output-language directives, where a readable name
(e.g. "Spanish") steers the model more reliably than a bare code ("es").
Mirrors the frontend list in src/utils/i18n/languages.js.
"""

LANGUAGE_NAMES = {
    # European (Parakeet TDT v3 supported set)
    "bg": "Bulgarian",
    "hr": "Croatian",
    "cs": "Czech",
    "da": "Danish",
    "nl": "Dutch",
    "en": "English",
    "et": "Estonian",
    "fi": "Finnish",
    "fr": "French",
    "de": "German",
    "el": "Greek",
    "hu": "Hungarian",
    "it": "Italian",
    "lv": "Latvian",
    "lt": "Lithuanian",
    "mt": "Maltese",
    "pl": "Polish",
    "pt": "Portuguese",
    "ro": "Romanian",
    "sk": "Slovak",
    "sl": "Slovenian",
    "es": "Spanish",
    "sv": "Swedish",
    "ru": "Russian",
    "uk": "Ukrainian",
    # Common non-European (remote endpoints)
    "ar": "Arabic",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "hi": "Hindi",
    "vi": "Vietnamese",
    "tr": "Turkish",
    "he": "Hebrew",
    "th": "Thai",
    "id": "Indonesian",
}


def get_language_name(code: str | None) -> str:
    """Return a human-readable language name for a code, falling back to the code."""
    if not code:
        return "English"
    return LANGUAGE_NAMES.get(code, code)
