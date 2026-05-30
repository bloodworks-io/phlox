# Warnings, Limitations, and Regulatory Considerations

**It is crucial to understand the limitations and potential risks associated with using Phlox.**  This project is provided for **educational and research purposes only.** **It is NOT intended for direct clinical use in its current state without rigorous validation, security hardening, and adherence to all applicable regulations.**

## Usage Warnings and Disclaimers

1.  **Experimental Software:** Phlox is an experimental, personal project. The code is under active development and may contain bugs, inconsistencies, and security vulnerabilities. It has not undergone formal testing or quality assurance processes expected of medical devices.

2.  **AI Hallucinations and Inaccuracies:** Phlox relies on Large Language Models (LLMs) for various functions. **LLMs are known to hallucinate,** meaning they can generate outputs that are plausible but factually incorrect or nonsensical.  **This is especially true for smaller, locally-run models.**

    - **Critical Verification:** **ALL AI-generated outputs from Phlox (clinical notes, summaries, correspondence, reference searches, etc.) MUST be independently verified by qualified medical professionals using trusted, primary sources.**  Do not rely solely on AI-generated information for clinical documentation.
    - **Risk of Misinformation:** AI-generated content may contain inaccurate medical information or misinterpret clinical context.  **Using unverified AI output in clinical practice could lead to patient harm.**

3.  **Not a Certified Medical Device:** Phlox is **not a certified medical device** and has not been evaluated or approved by any regulatory bodies (e.g., FDA, TGA, MHRA, etc.).  It most likely does not meet the regulatory requirements for medical devices in any jurisdiction.

4.  **No Regulatory Compliance (HIPAA, GDPR, TGA, etc.):** Phlox, in its default configuration, **does not comply with regulations such as HIPAA, GDPR, or TGA regulations, or any other patient data privacy or medical device regulations.**

    - **Data Security and Privacy:** Phlox lacks advanced security features, user authentication, audit logs, and data access controls required for regulatory compliance.
    - **Database Encryption:** While basic database encryption is available, this is not a comprehensive security measure.
    - **Transcription Data:**  Consider the privacy implications of your chosen Whisper transcription service, especially if using cloud-based APIs.

5.  **Authentication and Access Control:** By default, Phlox has no user authentication. Proxy authentication can be enabled for deployments behind a reverse proxy (see Setup guide). The desktop app requires a passphrase to unlock the encrypted database and uses native keychain integration. **Exposing Phlox to the public internet without authentication is highly discouraged and poses a significant security risk.**

6.  **MCP Server and External Tool Security:** When connecting external MCP servers or using built-in tools that call external APIs (PubMed, Wikipedia):
    - Patient data may be transmitted to third-party services depending on configuration
    - The "Filter Sensitive Data" toggle for MCP servers strips patient-identifying information from arguments, but is not guaranteed to catch all PHI
    - External services may log, cache, or retain transmitted data
    - You are responsible for ensuring that any external service complies with applicable privacy regulations

7.  **Intended Use - Educational and Personal:** Phlox is primarily intended for:
    - **Educational purposes:**  To explore the potential of AI in administrative workflows and learn about LLMs and related technologies.
    - **Personal use:** For experimentation, research, and non-clinical exploration of AI-assisted note-taking and information management.
    - **Development and Research:** As a platform for further development, research, and contribution to open-source medical AI tools.


**By using Phlox, you acknowledge and accept these warnings and limitations. You assume full responsibility for any use of Phlox and agree to use it ethically, responsibly, and in compliance with all applicable laws and regulations.**

**If you are unsure about any aspect of these warnings or the regulatory implications of using Phlox, DO NOT USE IT in a clinical setting without obtaining professional advice and implementing all necessary safeguards.**
