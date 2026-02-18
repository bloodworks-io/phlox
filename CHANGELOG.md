# Changelog

## [0.8.0](https://github.com/bloodworks-io/phlox/compare/v0.7.1...v0.8.0) (2026-02-18)


### Features

* ability to dictate letter in addition to existing ambient listening option ([1a91a56](https://github.com/bloodworks-io/phlox/commit/1a91a56b63684bc11e2de1077100adcb6eae7230))
* ability to resent individual sytem prompts to defaults ([1077535](https://github.com/bloodworks-io/phlox/commit/1077535f22c3210969ca95c1984afae00f106482))
* add date of birth to letter generation parameters ([0585041](https://github.com/bloodworks-io/phlox/commit/05850410fd0a68673ba45527d2adf9932d76d390))
* backend implementation of local whisper service for desktop builds ([14010e1](https://github.com/bloodworks-io/phlox/commit/14010e1c1f6487064bab85400d8de72f35644b0c))
* backend support for date of birth in letter generation ([909ff51](https://github.com/bloodworks-io/phlox/commit/909ff514052f2c7f08c1ab10918c618f76025f31))
* backend support for date of birth in letter generation ([fa48587](https://github.com/bloodworks-io/phlox/commit/fa485872d3fa667fd213344300735a2c34451728))
* backend support for date of birth in letter generation ([119d031](https://github.com/bloodworks-io/phlox/commit/119d0312311202c75e1fd7ef9fbfc75f94de1b7e))
* backup db prior to migration ([eda6757](https://github.com/bloodworks-io/phlox/commit/eda6757122ec92b28355a39f3cae65bfbc36c940))
* cohesive text area appearance ([9a1bda8](https://github.com/bloodworks-io/phlox/commit/9a1bda8ff82364799fd66865f8c365ca9e6e4fdf))
* consolidate adaptive refinement instructions; adaptive refinement is now non-blocking ([febfd37](https://github.com/bloodworks-io/phlox/commit/febfd373929fcce15d1826cf2a067d83aa66a6aa))
* deduplication module ([5cfb2e8](https://github.com/bloodworks-io/phlox/commit/5cfb2e8b54013a8677cfcf0bd191faf3343c488c))
* dictate correspondence directly with LLM assited formatting ([d98bc2b](https://github.com/bloodworks-io/phlox/commit/d98bc2b300b7429567522d91852381db23cf5a86))
* draft local inference engine with llama-cpp-python ([7421a07](https://github.com/bloodworks-io/phlox/commit/7421a077ee1ea6ad4dbdb112a23b7249bc4e5651))
* frontend local whisper service implementation ([7746da4](https://github.com/bloodworks-io/phlox/commit/7746da465e544fc4b9415565a6f9f0c09611ff57))
* implement tools definition for ChatEngine in dedicated module ([f5d636f](https://github.com/bloodworks-io/phlox/commit/f5d636f6fe0d0fc966203d7a5d69747b46d51951))
* improve identification of primary condition of episode ([e9f13d8](https://github.com/bloodworks-io/phlox/commit/e9f13d8296feaae4ef8191b7caadac65e9fc4aae))
* improved interface of prompt manager ([ea90e20](https://github.com/bloodworks-io/phlox/commit/ea90e202e8f38e5dd8e260247cdd10d8fa80f299))
* improved JSON repair ([4fda56d](https://github.com/bloodworks-io/phlox/commit/4fda56d21f6fa8be84944d4f919cc5ddb7a9c710))
* improved layout of settings panels ([7fe2e1f](https://github.com/bloodworks-io/phlox/commit/7fe2e1fa50b483f022c9eeb049aa17d32056d98d))
* improved reasoning display ([0e9ab49](https://github.com/bloodworks-io/phlox/commit/0e9ab49797fda9c8f6a9b2bf3cda5ce6bfc851a4))
* initial draft for splash-screen ([4086a80](https://github.com/bloodworks-io/phlox/commit/4086a8063778337daeedb37d5412d291a5eb6e13))
* local model frontend ([df28984](https://github.com/bloodworks-io/phlox/commit/df28984fad6a75796422c1e0f7418ff17a018bde))
* native keychain integration and encrytion for tauri desktop implementation ([49f6770](https://github.com/bloodworks-io/phlox/commit/49f677013cb82f099e99a9af7369fe39838cfa87))
* non-blocking summarisation requests ([8b20317](https://github.com/bloodworks-io/phlox/commit/8b20317b7d6567694add7510882055c3eea7c6a5))
* overhauled action buttons and recording widget ([028a52b](https://github.com/bloodworks-io/phlox/commit/028a52bd6d0267fbadc2c65111c496acb6844cb8))
* pass extra llm params via env ([e69f838](https://github.com/bloodworks-io/phlox/commit/e69f8386ce3fb55a2990f34509cb56d0a2700284))
* podman secrets ([2812df1](https://github.com/bloodworks-io/phlox/commit/2812df1e5cc5cfff38028d816aca164cf07e1be6))
* podman secrets ([9354de6](https://github.com/bloodworks-io/phlox/commit/9354de6f8a1cc0a747b79e26749df726e0a3e3a4))
* podman secrets ([b34c9a2](https://github.com/bloodworks-io/phlox/commit/b34c9a2a2bfd305fcbbaa10a9927e7bd5e107e29))
* podman secrets ([2ae4d09](https://github.com/bloodworks-io/phlox/commit/2ae4d0948fba234b2531c825733895db5c4d4fec))
* probe models for capability on save ([b8365b0](https://github.com/bloodworks-io/phlox/commit/b8365b0cbcb9a7ec5066d1d7500ffa12e82c71e0))
* process-manager to co-ordinate services ([41227f6](https://github.com/bloodworks-io/phlox/commit/41227f605daf0ebeab9fc29665b597d1c4e008a9))
* Server startup loader ([68cd80e](https://github.com/bloodworks-io/phlox/commit/68cd80e4651ec2f12a3f4acb91747e8aab1555bc))
* sound effects for jobs list ([52c1716](https://github.com/bloodworks-io/phlox/commit/52c1716f3dfad505a7ddd20e9346883674e22924))
* tauri build for desktops ([296fa5a](https://github.com/bloodworks-io/phlox/commit/296fa5af7d539ffd276adf777cfee020605595a0))
* tauri desktop build, local inference, and major refactor ([dd67917](https://github.com/bloodworks-io/phlox/commit/dd679178156af07c9390ade5682f4e903e473c1d))
* UI enhancement for desktop ([6959983](https://github.com/bloodworks-io/phlox/commit/6959983e28d6d624bc3bad17693deef4c6f98acc))
* UI enhancements for desktop ([591ee8b](https://github.com/bloodworks-io/phlox/commit/591ee8be8ad54570a1238b48d65c1f8fe3c2ae4d))
* working backend compiled on macOS ([ea620e7](https://github.com/bloodworks-io/phlox/commit/ea620e7b4e867232e224f6eb766acc3a2acfc6cb))


### Bug Fixes

* add json example to system message ([5d26cd9](https://github.com/bloodworks-io/phlox/commit/5d26cd9063f400c3a39a36b62b69f9482f0fb7b0))
* add json shape hints to all LLM calls ([57bfe2f](https://github.com/bloodworks-io/phlox/commit/57bfe2f61837918674f0ce905990b0c764688ebe))
* add random seed for diversity in LLM outputs ([0c873bd](https://github.com/bloodworks-io/phlox/commit/0c873bdcb3cfb1e0ba31b9c1bb0029b5d890787c))
* added extra fields to splash; prevents them being set to None ([f0f5fa0](https://github.com/bloodworks-io/phlox/commit/f0f5fa0d1d701b9578cf3fb2a10b805df0139aea))
* attempt to repair JSON structured outputs (more of an issue with buggy grammar backends) ([20272af](https://github.com/bloodworks-io/phlox/commit/20272afd22217543dab9144763d4241497f5a762))
* changelog path ([dfb40fa](https://github.com/bloodworks-io/phlox/commit/dfb40fa4ed2f98b39497b9ab38fd7fa4443779a1))
* chroma local models ([1352de7](https://github.com/bloodworks-io/phlox/commit/1352de713fb7e396b7a228167db8ba700c843b92))
* compose file improvements ([3527c6f](https://github.com/bloodworks-io/phlox/commit/3527c6f512533f9ff69ed907d75c813c7fd255e4))
* convert LLM responses to ASCII ([963c16a](https://github.com/bloodworks-io/phlox/commit/963c16a029516007e5b0902e6174a50916138e39))
* decode any HTML in LLM response ([ba29f79](https://github.com/bloodworks-io/phlox/commit/ba29f79dccc3f3b183b99e3bf64aa81c8d574aa0))
* document processing uses new llm_client ([a23398a](https://github.com/bloodworks-io/phlox/commit/a23398ad9713418e40ddee1e9d7ea58e7de2b99b))
* drag area in Tauri ([2ec7be7](https://github.com/bloodworks-io/phlox/commit/2ec7be778074cc393dba9ff20b46e6dc49e80354))
* embarrassing inverted sign in vector similarity logic ([151e52b](https://github.com/bloodworks-io/phlox/commit/151e52bc049fbd867bd6ca791c8eaab4acc8f37c))
* embedding model options in settings ([8f70b7e](https://github.com/bloodworks-io/phlox/commit/8f70b7ee89dd07cadf4e929110c55513325f3d8d))
* existing users dont need to see splash ([320ccd6](https://github.com/bloodworks-io/phlox/commit/320ccd694e9f1c93defa580c76d47e93b0f8dfa1))
* fixed model recommendations ([4883f2c](https://github.com/bloodworks-io/phlox/commit/4883f2c857bca85f5e74b9d958cf576edbadb8e3))
* improve sidebar behaviour ([7b93f0b](https://github.com/bloodworks-io/phlox/commit/7b93f0bc7592c086031be061042dd92b21055b5a))
* improve thinking mode detection ([6bc45a0](https://github.com/bloodworks-io/phlox/commit/6bc45a049090b7ce050fb39e4d40dc26f71240ae))
* improved wrong key detection; async server launch ([41adeee](https://github.com/bloodworks-io/phlox/commit/41adeeea9d7c7939073b18724be821328fe5025a))
* improvements in port binding configuration ([73303a2](https://github.com/bloodworks-io/phlox/commit/73303a23f68b43915135ebbb2db7f79f4c8cd582))
* improvements to local model management ([e7aafcd](https://github.com/bloodworks-io/phlox/commit/e7aafcd70695fe77d0b7a5329dabcc12adcd9a2d))
* imrpovements to Dictate mode ([f815ceb](https://github.com/bloodworks-io/phlox/commit/f815cebeabb47d739afc9a48d8110dbc03646aae))
* incorrect parameter name for clean_think_tags ([ce64951](https://github.com/bloodworks-io/phlox/commit/ce64951e1ca507a6b422097e0fb8a66edacef04e))
* incorrect requirements for prod Dockerfile ([fd90f21](https://github.com/bloodworks-io/phlox/commit/fd90f21063db31e2681591835e6e66152837a048))
* incorrect requirements for prod Dockerfile ([97afd50](https://github.com/bloodworks-io/phlox/commit/97afd50ec519bdd3c10b8946ac5c33289a1e9845))
* initialize demo db correctly ([796aa02](https://github.com/bloodworks-io/phlox/commit/796aa022212cd81037d5b575070fafb40ab4f671))
* initialize spash screen ([52895fa](https://github.com/bloodworks-io/phlox/commit/52895fa831e26afd0490976852a60278f469326d))
* last item sound effect ([ee7fe2e](https://github.com/bloodworks-io/phlox/commit/ee7fe2e99d1325459f3439eea26aa19d06d2377c))
* LLM call and JSON parsing issues ([05fe29e](https://github.com/bloodworks-io/phlox/commit/05fe29e9c64abbdaea71607a616a0c988b6ded1f))
* LLM extra body arg doesn't no longer applies to streaming requests (compatibility issues) ([d6697d6](https://github.com/bloodworks-io/phlox/commit/d6697d6d2813d412b9f737d51dd3d52e9c0a2b1c))
* local model dropdowns ([f46a93e](https://github.com/bloodworks-io/phlox/commit/f46a93e196f725e03d4c48545ad1fff920a03d3a))
* local model fixes ([d02bdc5](https://github.com/bloodworks-io/phlox/commit/d02bdc5c622787448829580e684389cc814bef80))
* local model path issues ([60a0b61](https://github.com/bloodworks-io/phlox/commit/60a0b612afde6c0d0c18441ca3bbb3198ad24112))
* logging format ([22c0f77](https://github.com/bloodworks-io/phlox/commit/22c0f7730057ad54178da4ad53de98ef13dab26d))
* made frontend timeouts longer ([2be8edb](https://github.com/bloodworks-io/phlox/commit/2be8edbc5b99965906417ef9c956c6f2b3376448))
* migrations failed ([10f1f08](https://github.com/bloodworks-io/phlox/commit/10f1f08a6b8b579d0e13b2ce74e15cd29ac35ef4))
* ollama grammar backend does not like injected thinking tags. Added dummy diadialogue. ([da15b8d](https://github.com/bloodworks-io/phlox/commit/da15b8d7c4aaf2cab03eef9a27dbd96cc529ac18))
* patient templates not refreshing for historical encounters ([1a4127c](https://github.com/bloodworks-io/phlox/commit/1a4127c271d6832735f723723c548ab1aa73e4af))
* Prevents frontend TypeError by ensuring function_response is always an array or null ([e5aa93d](https://github.com/bloodworks-io/phlox/commit/e5aa93d28c58c7d8fdc0f4fee397556e9d852af5))
* previous visits work again. ([db321be](https://github.com/bloodworks-io/phlox/commit/db321bed1ecdcef615792c009fa2581adc8eea4e))
* process manager fixes ([d00cbb6](https://github.com/bloodworks-io/phlox/commit/d00cbb65970657b15f477dd6f8450f1fd46a1f09))
* reasoning improvements ([d03b021](https://github.com/bloodworks-io/phlox/commit/d03b0210eb76ac462fe72bcf48d283311ea64824))
* remove chat items from Tauri build ([642f117](https://github.com/bloodworks-io/phlox/commit/642f117e6383e5fd7286b632c7890e0e1abf1141))
* remove unused stop tokens ([9737c62](https://github.com/bloodworks-io/phlox/commit/9737c62a0a86fc4f94d8d2acf9f88c55db3549be))
* remove unused stop tokens ([aab0f2c](https://github.com/bloodworks-io/phlox/commit/aab0f2c98bd2bf7a581c1bb1469bc82077704e05))
* rss url validation ([d956ed8](https://github.com/bloodworks-io/phlox/commit/d956ed8a9de4f786628d24adee75ce4db6ad0987))
* scheduler improvements ([8664f45](https://github.com/bloodworks-io/phlox/commit/8664f45c66c8cbd6963b1d9932dbccf59f193245))
* server connection check import ([7e15935](https://github.com/bloodworks-io/phlox/commit/7e159351d4e68bde802285a644198050f4530a6d))
* server info error from dashboard ([e6e1424](https://github.com/bloodworks-io/phlox/commit/e6e142493c92679e154b46c61c6bdd7a9803774f))
* splash screen bugs ([f413946](https://github.com/bloodworks-io/phlox/commit/f413946256d003a0ee0a03dc1ab3612b184d673e))
* start to unplumb seperate thinking model logic ([962e9c0](https://github.com/bloodworks-io/phlox/commit/962e9c048631e6ed017ee586a6ec591e214deb8e))
* summarisation function ([3a31682](https://github.com/bloodworks-io/phlox/commit/3a31682fe3e807983587ed74a0b3face29009e8b))
* sync reasoning and primary model ([5de99df](https://github.com/bloodworks-io/phlox/commit/5de99df3d2b4bc7571ff1cbc0d80da15a4a676fe))
* update chroma.py to use llm_client module ([ac87e71](https://github.com/bloodworks-io/phlox/commit/ac87e711d8d17473af80c06e7f9a010700aab695))
* update reasoning schema ([9722b07](https://github.com/bloodworks-io/phlox/commit/9722b0766e7661a2346abb26eb2528758746fe1f))
* use chromaDB built in embeddings for local deployments ([7b508aa](https://github.com/bloodworks-io/phlox/commit/7b508aa5d2933c788250370417eacb6c69075281))
* use jinja argument with local llama-server command ([7c6098c](https://github.com/bloodworks-io/phlox/commit/7c6098c7dc37917f56c82251786a0c854c18711a))
* use local data dir where appropriate and enhance logging in constants and connection modules ([5230004](https://github.com/bloodworks-io/phlox/commit/5230004a3774b0bfa7e6ad305e628434d9ac824b))
* use low temperature instead of 0 to avoid greedy decoding and enable non-deterministic reprocessing ([f510d45](https://github.com/bloodworks-io/phlox/commit/f510d45c37cfaab9ba391715e5e14ce880f76c0e))
* warm up server first ([ad8cf0d](https://github.com/bloodworks-io/phlox/commit/ad8cf0d2a2f8c1980ad4affcb90782b71803f231))

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
