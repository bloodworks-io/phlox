# Changelog

## [0.8.0](https://github.com/bloodworks-io/phlox/compare/v0.7.1...v0.8.0) (2025-09-19)


### Features

* podman secrets ([b34c9a2](https://github.com/bloodworks-io/phlox/commit/b34c9a2a2bfd305fcbbaa10a9927e7bd5e107e29))
* podman secrets ([2ae4d09](https://github.com/bloodworks-io/phlox/commit/2ae4d0948fba234b2531c825733895db5c4d4fec))


### Bug Fixes

* incorrect parameter name for clean_think_tags ([ce64951](https://github.com/bloodworks-io/phlox/commit/ce64951e1ca507a6b422097e0fb8a66edacef04e))
* Prevents frontend TypeError by ensuring function_response is always an array or null ([e5aa93d](https://github.com/bloodworks-io/phlox/commit/e5aa93d28c58c7d8fdc0f4fee397556e9d852af5))
* remove unused stop tokens ([aab0f2c](https://github.com/bloodworks-io/phlox/commit/aab0f2c98bd2bf7a581c1bb1469bc82077704e05))

## [0.7.1](https://github.com/bloodworks-io/phlox/compare/v0.7.0...v0.7.1) (2025-05-31)


### Bug Fixes

* max_items for adaptive refinement increased ([b073df6](https://github.com/bloodworks-io/phlox/commit/b073df657318f60c7e9fe4548be130c78cc35d11))

## [0.7.0](https://github.com/bloodworks-io/phlox/compare/v0.6.1...v0.7.0) (2025-05-30)


### Features

* adaptive refinement; the app wil learn the user's preference for note-style ([a2c6ba1](https://github.com/bloodworks-io/phlox/commit/a2c6ba1224dfa86a12bc0f906c315db4a937280e))
* endpoint for erasing adaptive refinement instructions for a given template field ([cd11ec6](https://github.com/bloodworks-io/phlox/commit/cd11ec6cba00723e4ca0f60a6a33cc1b32d7ad12))


### Bug Fixes

* syntax error ([21737a4](https://github.com/bloodworks-io/phlox/commit/21737a438ad1a341d8a97ad54bcc8d1f9055aea8))
* template updates will copy over to adaptive refinements ([cd11ec6](https://github.com/bloodworks-io/phlox/commit/cd11ec6cba00723e4ca0f60a6a33cc1b32d7ad12))
* updated adaptive refinement to also work on re-processing. ([42f940f](https://github.com/bloodworks-io/phlox/commit/42f940f92e751ab7285f9c20d9b23df209c62135))

## [0.6.1](https://github.com/bloodworks-io/phlox/compare/v0.6.0...v0.6.1) (2025-05-28)


### Bug Fixes

* initialization error for new instances - default to ollama ([bfaff93](https://github.com/bloodworks-io/phlox/commit/bfaff93b25888d0f82264faf210bf9f4c4d51708))

## [0.6.0](https://github.com/bloodworks-io/phlox/compare/v0.5.0...v0.6.0) (2025-05-26)


### Features

* initial draft support for openai-compatible endpoints ([bdf5e07](https://github.com/bloodworks-io/phlox/commit/bdf5e07cbf13e06e7d44ec085769a2e16fa2d203))
* new speed dial menu for chat and letters ([b9d24f3](https://github.com/bloodworks-io/phlox/commit/b9d24f3b21b995c12b6f3f09393e8f0242c9c788))
* thinking model improvements in chat ([80832be](https://github.com/bloodworks-io/phlox/commit/80832be58a8e960df915db05a81dcbf046d93f07))


### Bug Fixes

* chat handler bug fixes ([1b950ff](https://github.com/bloodworks-io/phlox/commit/1b950ff9f1f35613910cc3286d4f3c39944afd43))
* corrected json_schema call to OAI backends ([1750c86](https://github.com/bloodworks-io/phlox/commit/1750c86defd3fb16eb3584915f60188eaad223d2))
* corrected json_schema call to OAI backends ([815ad48](https://github.com/bloodworks-io/phlox/commit/815ad48ef0bf4e9ad0bd3368b24b82133c9591fb))
* database schema update ([c013577](https://github.com/bloodworks-io/phlox/commit/c013577ab78b1e2d483529067c962de20a93bb38))
* further fixes to reasoning models in dashboard and other secondary areas ([677989c](https://github.com/bloodworks-io/phlox/commit/677989cbbc2fc262abbc161a29f82c9c73f3b694))
* further refinements to chat interface ([2d3b019](https://github.com/bloodworks-io/phlox/commit/2d3b0193b15665f69517e4efc27498695a17823d))
* improvements for Qwen3 models ([c021a6a](https://github.com/bloodworks-io/phlox/commit/c021a6acaf5c07d5468272b526782879d3f976fe))
* incremental improvements to reasoning model handling in RAG ([8bfbdf5](https://github.com/bloodworks-io/phlox/commit/8bfbdf55ca6e4341be7a374a258a5579203e6a68))
* initial draft of the improved, more modern sidebar layout ([133f009](https://github.com/bloodworks-io/phlox/commit/133f009e3e45daf036cf1218bc01a0ba35015b05))
* Layout fixes ([dfb741f](https://github.com/bloodworks-io/phlox/commit/dfb741fb15a446ac09fdb2fc785bf05ae568a72f))
* layout fixes for patient jobs table ([bb95693](https://github.com/bloodworks-io/phlox/commit/bb95693117ee279f888d30687d9d8f90a2cbfa23))
* letter bug fix. Now use general prompt options for chat ([81b8485](https://github.com/bloodworks-io/phlox/commit/81b848543d1f54fd69991504044a831484e177c6))
* letter component and chat component fixes ([d03121e](https://github.com/bloodworks-io/phlox/commit/d03121ecbede3bf1cb366a198599b19a4c3b1aa5))
* letters support reasoning models by forcing structured output ([c22536d](https://github.com/bloodworks-io/phlox/commit/c22536dbe76f2671d3785b93a9d19b9dfae36232))
* opacity of speed dial ([05179d6](https://github.com/bloodworks-io/phlox/commit/05179d62e7e015f2d135bb3b695f35cd690016be))
* RAG was broken with the new OpenAI endpoints. Fixed ([034ebf3](https://github.com/bloodworks-io/phlox/commit/034ebf3e42ce7de8e250e2e5fdb85561f74f6be3))
* re-worked qwen3 support during refinement ([b17bda5](https://github.com/bloodworks-io/phlox/commit/b17bda5f113832ee8ed111b8e6cec811042c9e31))
* recording widget layout ([3c27c5d](https://github.com/bloodworks-io/phlox/commit/3c27c5d577e08ba526325c894c8c31179816d5ff))
* sidebar layout fixes ([b9d24f3](https://github.com/bloodworks-io/phlox/commit/b9d24f3b21b995c12b6f3f09393e8f0242c9c788))
* style fixes and refinements throughout the application ([da7c6dd](https://github.com/bloodworks-io/phlox/commit/da7c6ddefd3ef6859d136f6aba026d55296a54f4))
* template generation now works with llm_client ([1b950ff](https://github.com/bloodworks-io/phlox/commit/1b950ff9f1f35613910cc3286d4f3c39944afd43))
* thinking tag improvements in Chat ([c089aea](https://github.com/bloodworks-io/phlox/commit/c089aea0e42c01f98622ffab219361f1e14b2be9))
* tool calling fix for OAI endpoints ([42aa821](https://github.com/bloodworks-io/phlox/commit/42aa8213aa7f8e9cdda3b67a791731d970b0514f))
* updated RagChat for reasoning models ([b9d24f3](https://github.com/bloodworks-io/phlox/commit/b9d24f3b21b995c12b6f3f09393e8f0242c9c788))

## [0.5.0](https://github.com/bloodworks-io/phlox/compare/v0.4.1...v0.5.0) (2025-04-24)


### Features

* Clean repetitive text that Whisper produces occasionally ([00edf57](https://github.com/bloodworks-io/phlox/commit/00edf57de7630485f5350b1cd67223efa2a138bb))
* Improved readability of settings panel text-areas ([f605140](https://github.com/bloodworks-io/phlox/commit/f605140c9f10b2cbd0660a8267368faa4adeb494))
* include a style example field for the LLM to better adhere to user's note format ([e9370ea](https://github.com/bloodworks-io/phlox/commit/e9370ea7c94b072db174ffb75a42fbae8f57fa2c))


### Bug Fixes

* better reliability by passing user query direct to transcript tool ([089df73](https://github.com/bloodworks-io/phlox/commit/089df732c55ffd47f4e1725af0654c9246b12475))
* document processing/OCR now works correctly with templates and adheres to style examples ([f3ce332](https://github.com/bloodworks-io/phlox/commit/f3ce3323633039c1c3ed77684399b0c4cc7c0831))
* removed redundant fields in default templates ([c15165e](https://github.com/bloodworks-io/phlox/commit/c15165e67239e90389e0d45f91a91f2eb5ea9a84))
* revert to verbose_json for Whisper call ([ae11eca](https://github.com/bloodworks-io/phlox/commit/ae11eca49f6fe47fc1eb036ed1cb8662afcb6c9b))
* Squashed more bugs in template generation from user-defined note ([e315457](https://github.com/bloodworks-io/phlox/commit/e3154572ad625b4800fb03658910ee7cce994f99))
* Template delete function now works ([f605140](https://github.com/bloodworks-io/phlox/commit/f605140c9f10b2cbd0660a8267368faa4adeb494))

## [0.4.1](https://github.com/bloodworks-io/phlox/compare/v0.4.0...v0.4.1) (2025-03-14)


### Bug Fixes

* Version not appearing in sidebar ([1cdd9ad](https://github.com/bloodworks-io/phlox/commit/1cdd9ad769d776e25098ec32bf54a71c4652b768))

## [0.4.0](https://github.com/bloodworks-io/phlox/compare/v0.4.0-pre...v0.4.0) (2025-03-14)


### Bug Fixes

* Changelog view now works in version info panel ([afff5f1](https://github.com/bloodworks-io/phlox/commit/afff5f1fc2628d69595b4e45d41010e9ef4b08f5))
* server.py ([12e5fd8](https://github.com/bloodworks-io/phlox/commit/12e5fd8fd0c22348ebf75a8740175e08d0aeb7f4))


### Miscellaneous Chores

* remove -pre suffix from versioning ([afff5f1](https://github.com/bloodworks-io/phlox/commit/afff5f1fc2628d69595b4e45d41010e9ef4b08f5))

## [0.4.0-pre](https://github.com/bloodworks-io/phlox/compare/v0.3.1-pre...v0.4.0-pre) (2025-03-14)


### ✨ Features

* ✅ Add transcription view and document processing ([5d76614](https://github.com/bloodworks-io/phlox/commit/5d76614b6a58f4162b1aafc2d070d02896405a37))
  * 🎙️ Initial transcription view with improved UI
  * 🔄 Refactored transcription calls to a separate module
  * 🛠️ Added error handling for failed transcription
  * 🤖 New LLM tool for providing direct information from transcripts
  * 💬 Updated Quick Chat appearance with new settings panel
  * 📝 Refined document upload interface
  * 📊 Added version info view and changelog workflow
