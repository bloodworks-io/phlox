class DefaultLetters:
    """Default letter templates for Phlox."""

    # Dictation template instructions
    DICTATION_INSTRUCTIONS = (
        "I'm going to dictate a letter to you. Please adjust the punctuation "
        "and wording where required to make it a polished letter; the substance, "
        "overall structure MUST remain as dictated. Even the wording should be "
        "largely the same. You are not to rephrase the letter in any substantial way.\n\n"
        "IMPORTANT: Please adhere to any instructions that may appear in the transcript; "
        "for example 'remove that' or 'insert a summary of the patients blood results'. "
        "Execute these instructions instead of transcribing them."
    )

    @staticmethod
    def get_default_letter_templates():
        """Get default letter templates for initial database setup.

        Returns:
            List of tuples (id, name, instructions)
        """
        return [
            (
                1,
                "GP Letter",
                "Write a brief letter to the patient's general practitioner...",
            ),
            (2, "Specialist Referral", "Write a detailed referral letter..."),
            (
                3,
                "Discharge Summary",
                "Write a comprehensive discharge summary...",
            ),
            (4, "Brief Update", "Write a short update letter..."),
        ]

    @staticmethod
    def get_dictation_template():
        """Get the Dictation letter template.

        Returns:
            Tuple of (name, instructions)
        """
        return ("Dictation", DefaultLetters.DICTATION_INSTRUCTIONS)
