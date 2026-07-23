# Changelog

## [2.1.0](https://github.com/bloodworks-io/phlox/compare/v2.0.0...v2.1.0) (2026-07-23)


### Features

* ability to replace stored forms ([e83c252](https://github.com/bloodworks-io/phlox/commit/e83c252fb15080355105b8f2823f8e9178e680db))
* **api:** add granular options reset endpoint ([c85e2d3](https://github.com/bloodworks-io/phlox/commit/c85e2d34382bb57749702ba35b18ea524a85b1f6))
* **audio:** replace MediaRecorder with WebAudio AudioContext ([a4498ee](https://github.com/bloodworks-io/phlox/commit/a4498ee3097e817b12fb6ae9bf38eba04b7f6ef4))
* **build:** add Linux build paths with pinned SHAs and CPU fallback ([da43bb3](https://github.com/bloodworks-io/phlox/commit/da43bb38169b3b900407922a735031cf27e7c9c0))
* **chat:** global citation numbering across multi-tool turns ([bec4426](https://github.com/bloodworks-io/phlox/commit/bec44263041b328fe5a53ec97044ba5cca587f24))
* **chat:** structured citations for wiki tool ([a41a2c7](https://github.com/bloodworks-io/phlox/commit/a41a2c794c8499bc88f60847c8cd650d8d90d611))
* **chat:** structured citations from search tools ([a803dbc](https://github.com/bloodworks-io/phlox/commit/a803dbcb8e55db791b1209250f5ba37f024fea5e))
* **demo:** seed fullsome demo data on tauri dev launch ([b3625c2](https://github.com/bloodworks-io/phlox/commit/b3625c2965e15fba589dbfbf6ce428e05a3b6f98))
* **dev:** force onboarding splash on every dev launch ([2d97e70](https://github.com/bloodworks-io/phlox/commit/2d97e70a7cb63c47ce572f32c5f78b210c4a835a))
* **embedding:** add embedding model API stubs and download service ([9d77dea](https://github.com/bloodworks-io/phlox/commit/9d77dea20a94b0015fcb234d8217c263348831cb))
* **embedding:** add embedding model download and endpoints ([2964db8](https://github.com/bloodworks-io/phlox/commit/2964db89bfe03c8f7668bab65c98dd64cca6a4fd))
* **embedding:** expose embedding lifecycle as Tauri commands ([7a40e8c](https://github.com/bloodworks-io/phlox/commit/7a40e8cdafb3b099f01ac2de37905ce6f740bcb4))
* **embedding:** manage embedding server in process manager ([3a5d45d](https://github.com/bloodworks-io/phlox/commit/3a5d45df14afca4bb738929063de60a0494f5fc4))
* **embedding:** wire UI to Qwen3 embedding endpoints ([3cb8d9b](https://github.com/bloodworks-io/phlox/commit/3cb8d9b81f1b90bec53419c7786f56aa6c20eae8))
* **helpers:** add toastApiError and toastApiSuccess helpers ([d554acc](https://github.com/bloodworks-io/phlox/commit/d554acccae007f654af126fdf46c2be4ad6e733e))
* introduce SWR cache layer with 6 initial migrations ([fe27acd](https://github.com/bloodworks-io/phlox/commit/fe27acd71e72630efe5eeb72f85c887c81296fad))
* **linux:** add Flatpak packaging ([e7c439a](https://github.com/bloodworks-io/phlox/commit/e7c439accda1b1c7b2a2340bd443f01e4584fb45))
* **linux:** auto-grant WebKit getUserMedia permission ([3fd370d](https://github.com/bloodworks-io/phlox/commit/3fd370d2f7e86697bc7861c7a92328617c6d3bb9))
* **perf:** add calibrated LLM estimate to model popovers ([7c70e11](https://github.com/bloodworks-io/phlox/commit/7c70e116511c7ea3a6a0d7e7a125ab8df86f7067))
* **rag:** editable document metadata ([949f3ba](https://github.com/bloodworks-io/phlox/commit/949f3ba7132e7a01230a93d8613012dc27850ee9))
* **rag:** gate RAG on embedding model availability for Tauri ([95ec1da](https://github.com/bloodworks-io/phlox/commit/95ec1da1c050e46648df592266175f1dda360b16))
* **rag:** improve ingestion pipeline; allow collection rename ([dc43939](https://github.com/bloodworks-io/phlox/commit/dc439396b8672db820ebcbc63f8d60a97211b3bd))
* **reasoning:** citation rule in system prompt ([89164b1](https://github.com/bloodworks-io/phlox/commit/89164b14782ea0f1a90506b72e327dfb286decd1))
* **security:** add origin validation to get_request_token command ([a70b4bc](https://github.com/bloodworks-io/phlox/commit/a70b4bc447a5c776d60393b3fc20cb6766e03c71))
* **security:** enable rate limiting for Tauri builds ([ca4b594](https://github.com/bloodworks-io/phlox/commit/ca4b5944d3016b3ffa8a8010ea7bbb65c0a3f47b))
* **security:** enforce strict CSP and disable global Tauri API ([2569971](https://github.com/bloodworks-io/phlox/commit/256997155b616f7647319b9da8f07b993343114f))
* **security:** mask API keys in config endpoint responses ([d334279](https://github.com/bloodworks-io/phlox/commit/d3342799658596c83e1099404ccd3de2f381255a))
* **server:** use parakeet OpenAI endpoint and single Omi Med STT model ([cea0513](https://github.com/bloodworks-io/phlox/commit/cea0513fd7e6367507154b7cf291ac14d971b4b1))
* **sidebar:** active states, accent discipline, and restructured nav ([33b82ee](https://github.com/bloodworks-io/phlox/commit/33b82ee7d0fc7bcf69752ba61f5dd0c8819f4c48))
* **sidebar:** add tooltips to sidebar controls ([d4ba96d](https://github.com/bloodworks-io/phlox/commit/d4ba96d483e1f6078773092b8ad8709b0c021c38))
* **sidebar:** hide day summary when no patients for the date ([3c92e16](https://github.com/bloodworks-io/phlox/commit/3c92e16f767bcd33c285cd520d906d5e4743849a))
* **sidebar:** mark New Note active on the new-note route ([abe747b](https://github.com/bloodworks-io/phlox/commit/abe747b12f8048919d0832755f30351e367298e4))
* **sidebar:** use flat full-height sidebar in web/docker mode ([fb3e6ba](https://github.com/bloodworks-io/phlox/commit/fb3e6ba5de464547e577fdb56766a03210f1d1ca))
* **tauri:** launch parakeet STT server and drop legacy process monitor ([6d73231](https://github.com/bloodworks-io/phlox/commit/6d73231a29156f16faf0ae64fbbacab021d724ba))
* **tauri:** Linux dGPU VRAM detection and pooled RAM/VRAM model filter ([bb13d39](https://github.com/bloodworks-io/phlox/commit/bb13d39300fec536381055836d08ac1edf463b05))
* **tool:** search by primary condition and fuzzy name. ([86bfef1](https://github.com/bloodworks-io/phlox/commit/86bfef1bdce6fa06b086602798ca60c2994d3469))
* **ui:** gate onboarding splash on Omi Med STT model download ([bff7a73](https://github.com/bloodworks-io/phlox/commit/bff7a73790fc6cf06715f3de85581fda0b0b402d))
* **ui:** inline citation pills with popovers + sources footer ([6ed8254](https://github.com/bloodworks-io/phlox/commit/6ed8254406276c42463e6e119e7b52b37f15460e))
* **ui:** polish elements ([b53678d](https://github.com/bloodworks-io/phlox/commit/b53678d8c77fb4d30a64d7a6892ac0b5ae6a0d7e))
* **ui:** replace framer-motion with theme keyframes ([81029b0](https://github.com/bloodworks-io/phlox/commit/81029b0702e931ec028c4f8c25dcf3a09ea62b85))
* **vision:** assume vision capable for local models ([77398d4](https://github.com/bloodworks-io/phlox/commit/77398d4d087a0a9690d84187549704e35452516c))
* **vision:** download multimodal projector with local models ([a04f5e6](https://github.com/bloodworks-io/phlox/commit/a04f5e6cfd40b7e7621cafd13dbc5bdecb0d117a))
* **vision:** load mmproj projector in local llama-server ([fa0b5c6](https://github.com/bloodworks-io/phlox/commit/fa0b5c6745e5e329c2247fdd2cf24f8515adc9bc))


### Bug Fixes

* align route names and improve checkbox visibility ([91bb265](https://github.com/bloodworks-io/phlox/commit/91bb26512d6a4d1974aa616678d369852ec2b43a))
* **api:** route document and patient fetches through buildApiUrl ([a2323fb](https://github.com/bloodworks-io/phlox/commit/a2323fbecadf0a037235b914c324675568fa120c))
* **api:** sanitize error responses ([eba7a9e](https://github.com/bloodworks-io/phlox/commit/eba7a9eb5b5daeefdb4b5a8d70e84e4da06eaed8))
* **chat:** dash chat rendering issue ([8d34f5b](https://github.com/bloodworks-io/phlox/commit/8d34f5bcc42287b1cbae24807f8330c566e34c76))
* **chat:** include more demographic info in context ([ce99a53](https://github.com/bloodworks-io/phlox/commit/ce99a5366740e393ca38195377917524c0ee9dac))
* **chat:** return error message when model calls unknown tool ([d094856](https://github.com/bloodworks-io/phlox/commit/d09485633edfa26a975bc396cce5ec9564239c2b))
* **chat:** runtime error ([0791d69](https://github.com/bloodworks-io/phlox/commit/0791d6915c8310b331eefc765f989a7df168c94c))
* **chat:** use local firstChunkSeen flag instead of state in sendMessage ([5445903](https://github.com/bloodworks-io/phlox/commit/54459036566b127a8c10a829cb1f47dde1d8fdd8))
* **database:** escape SQLCipher passphrase in PRAGMA key ([592e504](https://github.com/bloodworks-io/phlox/commit/592e5047de87916d819a399786c1ed38b479ab79))
* **dev:** re-enable PHLOX_DEMO_MODE in debug builds ([7237da4](https://github.com/bloodworks-io/phlox/commit/7237da42a5ea41d9aa80238fec4ba8d71675138e))
* drop orphaned rag/processing.py ([72ad3ff](https://github.com/bloodworks-io/phlox/commit/72ad3ffc6242b217618e364c30d10459e02034b3))
* **helpers:** preserve error detail and tolerate empty bodies in ([1d30ddb](https://github.com/bloodworks-io/phlox/commit/1d30ddb91ef8602460f0f2bb6c1478356ec144a0))
* incorrect new-note modal routing ([833a76c](https://github.com/bloodworks-io/phlox/commit/833a76cf14f9e9b06b484ce7d1da32a7e58d1087))
* **layout:** unify content padding between Tauri and web modes ([e022e99](https://github.com/bloodworks-io/phlox/commit/e022e9923d8f53e625b20df6b6fdbe96d19373b8))
* **lint:** clear remaining singletons for v7 rules ([b10c086](https://github.com/bloodworks-io/phlox/commit/b10c0864f9c0938ca40838b1096d6bea3002e044))
* **linux:** data directory case ([d8d5e6e](https://github.com/bloodworks-io/phlox/commit/d8d5e6e4fb7128dd14f85c51eb9897230a7baa32))
* **llm:** increase context size to 16384 for multi-page vision ([67e092d](https://github.com/bloodworks-io/phlox/commit/67e092d2e86114c572f06dd95738fd19be981e53))
* **note:** always show confirmable search results in start card ([bf39797](https://github.com/bloodworks-io/phlox/commit/bf39797d874b56db26bbf506888239ca86e013fc))
* **note:** dismiss start card after successful patient search ([ddd0e4e](https://github.com/bloodworks-io/phlox/commit/ddd0e4ecbe4e0becb99b4cf5f009d7b6b39e4bba))
* **pages:** force revalidateOnMount on ClinicSummary and OutstandingJobs ([c4f45df](https://github.com/bloodworks-io/phlox/commit/c4f45dfd1c0fff5190887fe2286464d207d3aab3))
* **patient:** immutable jobs_list update for SWR compatibility ([e5ea8f8](https://github.com/bloodworks-io/phlox/commit/e5ea8f8e1e5c0848230635f8595a080770b2d59e))
* **patient:** revert reset effect deps to unbreak PatientDetails ([4b7d8da](https://github.com/bloodworks-io/phlox/commit/4b7d8da9b2a6a62c3103e2be8ce954af7d09bdf3))
* **pdf:** configure pdfjs wasmUrl to fix JBIG2 image decoding in scanned ([75b419e](https://github.com/bloodworks-io/phlox/commit/75b419e51fab65761872156436975d5df62bb5e8))
* prevent stale settings wipe on partial save ([22018f6](https://github.com/bloodworks-io/phlox/commit/22018f6a246b5f9d1baf02ac4229fae0a34394b4))
* **rag:** repair broken try/except for PDF download lookup ([533d911](https://github.com/bloodworks-io/phlox/commit/533d9117b795af85f31dbbb63995aa0c4a4ef40b))
* **rag:** resolve local embedding base url from dynamic port ([4ecee95](https://github.com/bloodworks-io/phlox/commit/4ecee9502e6eaf97e567571e0e8c0bbae66fe37b))
* **rag:** spinners on file upload ([049e0f6](https://github.com/bloodworks-io/phlox/commit/049e0f6855b23ada8efb775c27152b510a77aa49))
* **security:** anchor middleware suffix bypass to non-API paths ([db28862](https://github.com/bloodworks-io/phlox/commit/db28862f49b4f7058819906625fc564e5f7663f2))
* **security:** make LocalTokenMiddleware fail closed when token unset ([257515d](https://github.com/bloodworks-io/phlox/commit/257515da98c6d2f6259cf543b4d2469ae7c4f3a1))
* **security:** stop logging bearer token in plaintext ([d7dc97f](https://github.com/bloodworks-io/phlox/commit/d7dc97f0950821b212965f7f4bc71239f79e2314))
* **security:** whitelist model paths to prevent path traversal ([5b2ba4a](https://github.com/bloodworks-io/phlox/commit/5b2ba4a20964dd1c806a6cefba15d542487b888b))
* **sidebar:** repair collapsed-logo hover-to-expand ([d9e27a7](https://github.com/bloodworks-io/phlox/commit/d9e27a7ff1202a5063843ab05ccd33c4e56bb8b6))
* **status:** detect whisper/embedding services via /health ([743e127](https://github.com/bloodworks-io/phlox/commit/743e1274affcdb9c7af86e9c000a63ba0fd2f15b))
* **tauri:** disable native window drag-drop ([430c6a5](https://github.com/bloodworks-io/phlox/commit/430c6a5d20a153de0e602faddd62dae72925eb9d))
* **tauri:** replace window.__TAURI__ guards with isTauri() ([289f9ad](https://github.com/bloodworks-io/phlox/commit/289f9ad5142ea9869b3708528c95cff67865e4e3))
* **tauri:** scheme-based origin check for production webview ([99fa2fb](https://github.com/bloodworks-io/phlox/commit/99fa2fbe56fe858aa6d8082bf9ad70c0c7c92f43))
* **templates:** route provider toasts through useApiToast ([541b465](https://github.com/bloodworks-io/phlox/commit/541b465fa119e67476415e46c6d7abd2a5452496))
* **theme:** add !important to nav-button for Chakra v3 override ([2b7657f](https://github.com/bloodworks-io/phlox/commit/2b7657f30023c6ed5b53832f5e92e99eee020837))
* **theme:** correct latent colorMode bugs in styles modules ([480cecc](https://github.com/bloodworks-io/phlox/commit/480cecc095dcb91a66b6b8d8f8981e24d7533a42))
* **theme:** correct semantic token registration and chat input colors" ([48fcf85](https://github.com/bloodworks-io/phlox/commit/48fcf85e6aa012d057c3c61e1ee05baf06a85028))
* **ui:** always follow system color mode instead of persisting manual ([0adc566](https://github.com/bloodworks-io/phlox/commit/0adc566f1125232821182ca05a4920da80e46c84))
* **ui:** correct mode-blind color reads in PatientTable and ([1a5c390](https://github.com/bloodworks-io/phlox/commit/1a5c39067c9f2a2e5d20cf2770b17d892f073544))
* **ui:** correct v3 prop leaks from v2 migration ([a038eca](https://github.com/bloodworks-io/phlox/commit/a038ecad33522c3f3fd3e0cab16b8596572d5de6))
* **ui:** finish v3 prop renames ([0733eb8](https://github.com/bloodworks-io/phlox/commit/0733eb804adbc45231e98816a09ec4b1b2ff0266))
* **ui:** floating action menu width ([12e8090](https://github.com/bloodworks-io/phlox/commit/12e8090c3485807a6f4d51ed4da6e873197e0814))
* **ui:** improve patient table colours ([d2acc50](https://github.com/bloodworks-io/phlox/commit/d2acc50b51fe619dbe0025eae96ba3157a0e47c4))
* **ui:** incorrect border on sidebar ([2f2a09e](https://github.com/bloodworks-io/phlox/commit/2f2a09e2194164aee2266687b03d7e9f4bed67a4))
* **ui:** isthmus not appearing for reasoning ([5c18ccd](https://github.com/bloodworks-io/phlox/commit/5c18ccdaaa71a740ff7a7f2f051deb12faedcb43))
* **ui:** line break on hover in sidebar ([c0af43c](https://github.com/bloodworks-io/phlox/commit/c0af43cae8180437ee45370672c17422b7336992))
* **ui:** prevent dashboard flash before unlock splash on Tauri boot ([3eacf97](https://github.com/bloodworks-io/phlox/commit/3eacf97579204c52ee13fd57ab4684784ed8497d))
* **ui:** reasoning icons ([dbb37d2](https://github.com/bloodworks-io/phlox/commit/dbb37d2e9d72be16c9ff1b86078d089da01eb23a))
* **ui:** recalibrate RAM requirements and tier assignments ([0ccfb92](https://github.com/bloodworks-io/phlox/commit/0ccfb92ff4eba38d9bf53616ea0ecf265e2a2c04))
* **ui:** remove dead whisper-model fetch causing settings crash ([e3277b4](https://github.com/bloodworks-io/phlox/commit/e3277b415a95c7c2a88ac342b0f744aa2ab6a2c0))
* **ui:** reposition reasoning panel resize handle ([6d08fcf](https://github.com/bloodworks-io/phlox/commit/6d08fcf71e402f520223be84f83b1ea804ff5992))
* **ui:** restore styling for tabs, tables, modals, form controls etc ([e11da91](https://github.com/bloodworks-io/phlox/commit/e11da919bbc025c4e49ca50be415dd30ca4e7116))
* **ui:** revert sidebar border ([dc48951](https://github.com/bloodworks-io/phlox/commit/dc489511e5a67709de5993f34b5d0c42382224fb))
* **ui:** sidebar cleanup ([72d87c1](https://github.com/bloodworks-io/phlox/commit/72d87c14b602131e5a022e1ca304f25ebe812b5c))
* **ui:** suppress redundant default-template toast on first start ([e8559bd](https://github.com/bloodworks-io/phlox/commit/e8559bdb3343a5195c66bf013da5623ecd3f766f))
* **ui:** toast styling ([c596ee4](https://github.com/bloodworks-io/phlox/commit/c596ee42ff35ed9f79eae34d8c9ffe6a47c2ecad))
* **ui:** use dynamic viewport units for full-height layouts ([98c61b0](https://github.com/bloodworks-io/phlox/commit/98c61b0a9f37f4e90a2516c71fa095fbd96335cc))
* **ui:** various styling inconsistencies ([6799d70](https://github.com/bloodworks-io/phlox/commit/6799d70851e59d9e652145787e88edaec6729675))
* **ui:** wire embedding model into splash ([c1c154a](https://github.com/bloodworks-io/phlox/commit/c1c154a9a586badcf72107c67ea381ede43a524e))
* unblock and pass frontend typecheck ([a1b3298](https://github.com/bloodworks-io/phlox/commit/a1b329821152e9b91604a5a36ff44e0a6d677049))
* **vision:** route image-only PDFs through vision, not legacy text ([566e557](https://github.com/bloodworks-io/phlox/commit/566e557e477120942748f8609e9c0bac34eaf625))


### Performance Improvements

* **embedding:** cap context and quantize KV to cut idle memory ([870996b](https://github.com/bloodworks-io/phlox/commit/870996b7fa47d39eb6b2bf92e0a48973a5bacf85))
* improve template loading behaviour ([cc9f02f](https://github.com/bloodworks-io/phlox/commit/cc9f02fc89441f8e36409a70ef9c04bed0dbcffc))
* **models:** filter models exceeding RAM with 4GB buffer ([bfadfed](https://github.com/bloodworks-io/phlox/commit/bfadfedaff6d7bdcd42a85668099dc15e42e7e09))
* serve dashboard chat suggestions from static client-side map ([85aec4f](https://github.com/bloodworks-io/phlox/commit/85aec4f882869d6fff88b51d0a7a25a153f1ff7b))
* settings load improvement ([8114035](https://github.com/bloodworks-io/phlox/commit/8114035d6841789a337ebf6e633ce1721d698ce1))
* **settings:** memoize smartRecommendations ([f88ff8c](https://github.com/bloodworks-io/phlox/commit/f88ff8cb5d758aba69447f98737f5403e632be0f))

## [2.0.0](https://github.com/bloodworks-io/phlox/compare/v1.0.5...v2.0.0) (2026-06-28)


### ⚠ BREAKING CHANGES

* remove ChromaManager. Existing RAG data will be lost.

### Features

* add PDF forms feature flag and expose PdfJs utility ([8465ecb](https://github.com/bloodworks-io/phlox/commit/8465ecbd0b6b3e03250dc457df8a8d3cebef3b54))
* add pluggable vector store backend with sqlite-vec implementation ([a495938](https://github.com/bloodworks-io/phlox/commit/a495938ad22a4f134b364ed5e966719bc2f51a5b))
* add SSE streaming for re-embedding progress ([f303531](https://github.com/bloodworks-io/phlox/commit/f303531e69dd1ca295695a527a2123733b09d7a6))
* add VectorStoreManager ([2fab8eb](https://github.com/bloodworks-io/phlox/commit/2fab8ebb4e58f66e7a4bd3a196aaf9ca4690db53))
* **api:** add job extraction endpoint for Wrap Up ([58817b0](https://github.com/bloodworks-io/phlox/commit/58817b06a46694717c1dc303bfde7982c5f97478))
* **api:** search patients by name as well as UR number ([c3b1d0e](https://github.com/bloodworks-io/phlox/commit/c3b1d0ef0a47cb0db98c65452eab0e59809f9cb5))
* bulk upload for reference documents ([24c677b](https://github.com/bloodworks-io/phlox/commit/24c677bd33b464296fb8e53d145c68dfd3df1507))
* **chat:** hide literature tool when the knowledge base is empty ([66020e2](https://github.com/bloodworks-io/phlox/commit/66020e21810b99ef2e8c77dde6b308b45e9d4d8f))
* **chat:** include demographics in patient context ([521f208](https://github.com/bloodworks-io/phlox/commit/521f208c56cb64c6b2e9e58af89e3dcfbe33923f))
* **client:** add pdf-lib dependency and PDF form utilities ([ad320a0](https://github.com/bloodworks-io/phlox/commit/ad320a08482a97f395cb249c0cabe2ed633e0339))
* **client:** add pdf-lib dependency and PDF form utilities ([57b1029](https://github.com/bloodworks-io/phlox/commit/57b1029d9a183465ad24e795fd9ff8a19af2e53a))
* **client:** render form-fill artifacts in chat ([e722648](https://github.com/bloodworks-io/phlox/commit/e7226486eae743a51b9e643f52c9036129782328))
* **consent:** persist ambient-scribe consent in patient_profiles ([d9757ae](https://github.com/bloodworks-io/phlox/commit/d9757ae12d52a1e45f6c4c8506bc411b76910ce4))
* **consent:** prompt for consent before ambient recording ([e6aa049](https://github.com/bloodworks-io/phlox/commit/e6aa0493143c0049f3216f32ba7946061e95fd96))
* **db:** add patient_profiles and seed job_extraction prompt ([df94ff5](https://github.com/bloodworks-io/phlox/commit/df94ff5d4df1ea652ea48978340534c1b6a27f57))
* **db:** store patient demographics in patient_profiles ([1f31a90](https://github.com/bloodworks-io/phlox/commit/1f31a90e722f15cc50fbdb5770ed8309a086457d))
* extract patient demographics from documents ([9596436](https://github.com/bloodworks-io/phlox/commit/9596436a903803be3c0abac8a2b48738cc97435f))
* **note:** auto-open demographics and gate recording on required fields ([a81fcdd](https://github.com/bloodworks-io/phlox/commit/a81fcdda3d0d652a55e85dd4e8e712ed58ceff1b))
* **notes:** add candidate results and confirm flow to modal ([91d57b3](https://github.com/bloodworks-io/phlox/commit/91d57b3123f6edd55183a6c3fe7138a8b6fb7960))
* remove ChromaManager. Existing RAG data will be lost. ([2b20f69](https://github.com/bloodworks-io/phlox/commit/2b20f691b993f175197c6bf8b38cfa5df2cec504))
* **scribe:** gate recording, recover failed, refactor scribe ([ed8ba66](https://github.com/bloodworks-io/phlox/commit/ed8ba66481ba1b7f7684049d9273acc688140f1a))
* **server:** add PDF form template storage, schemas, and API ([660dc3a](https://github.com/bloodworks-io/phlox/commit/660dc3a9566a626569feb2e812b714b54a1da8f2))
* **server:** integrate PDF form tools into chat ([dbe335c](https://github.com/bloodworks-io/phlox/commit/dbe335cafcc11652bfda1d32f0dff104dc7b4a8d))
* store original pdf ([6160016](https://github.com/bloodworks-io/phlox/commit/6160016970d49e1adb602b45bc368f5c0bbb07ed))
* surface binary MCP tool responses as downloadable artifacts in chat UI ([b3acf7c](https://github.com/bloodworks-io/phlox/commit/b3acf7c7a512bf46c6ad1c041c9756a5ba2cd32d))
* **ui:** add patient demographics modal ([859e555](https://github.com/bloodworks-io/phlox/commit/859e555a2849124d1e63ed51ee41d38b774ffd4c))
* **ui:** add Wrap Up modal and extract-jobs client ([27c01a9](https://github.com/bloodworks-io/phlox/commit/27c01a9b5fd9120f0d0693d10c20cd74001ac47c))
* **ui:** auto-fill demographics from a dropped document ([44276a9](https://github.com/bloodworks-io/phlox/commit/44276a97ad5d24d614d416cd43ce023a4d4e684b))
* **ui:** compact summary-only table view ([3cae57f](https://github.com/bloodworks-io/phlox/commit/3cae57f02f373d75cb2e2a1917f834618555c85a))
* **ui:** new note splash for clarity ([500f95a](https://github.com/bloodworks-io/phlox/commit/500f95aeccef137a7a5bbeb0a0f51ea6646bfe46))
* **ui:** wire Wrap Up to save jobs and advance to next not ([3f6cb9b](https://github.com/bloodworks-io/phlox/commit/3f6cb9b9762786cfa57465967b7c2b8c08509e27))


### Bug Fixes

* binary data not showing in dashboard chat. ([cf4b375](https://github.com/bloodworks-io/phlox/commit/cf4b375cf0f1d8d17bd9e257ae9fb950f41592d1))
* bulk upload respects pdf commit setting ([3618023](https://github.com/bloodworks-io/phlox/commit/36180234c158e1395dfd8df548b53a4a9ac9c106))
* **chat:** drop distance threshold from literature search ([f411b37](https://github.com/bloodworks-io/phlox/commit/f411b37862a6fe612a6ac9006242d4245bfab5cd))
* citations now displaying in chat ([cccd92b](https://github.com/bloodworks-io/phlox/commit/cccd92b593847c6097f6e153ad8a301d265c4cf5))
* **demo:** give demo patients unique ur numbers ([9dcb8ba](https://github.com/bloodworks-io/phlox/commit/9dcb8bae3b2b703b0c04a21f8cf8b09020c1f741))
* **demo:** str for type check ([5b35632](https://github.com/bloodworks-io/phlox/commit/5b356321d4d673db5323211a3ed5aef93bd3cd05))
* increase timeout for PDF field detection ([f678553](https://github.com/bloodworks-io/phlox/commit/f678553c3967b1f5592f7901199af7e94ec22bee))
* **note:** clear patient state when starting a new note after wrap-up ([0e623dd](https://github.com/bloodworks-io/phlox/commit/0e623dd479c68f48c34e18a9244dfb870966636f))
* **note:** show start card after wrap-up on new patient ([aba5c08](https://github.com/bloodworks-io/phlox/commit/aba5c08f6218f8e6a211e12b8cc8d92cd7f3c1f7))
* **rag:** store source PDF on single-file upload ([26caeca](https://github.com/bloodworks-io/phlox/commit/26caecaaf2d8019d43bd0869a3aa0275dc13cf31))
* reload embedding function before re-embedding ([4a2f4fd](https://github.com/bloodworks-io/phlox/commit/4a2f4fd3656bc4da96b49ecd6579a2eae635ce07))
* **server:** bundle sqlite-vec into into tauri; split OCR libs ([b869680](https://github.com/bloodworks-io/phlox/commit/b8696801fd6fb642727e9695c2b91c247cb993a1))
* **tauri:** make the readiness wait non-blocking; surface stderr on ([21f961b](https://github.com/bloodworks-io/phlox/commit/21f961b6e0dbd2e2d6b159c173d9845afb5b2ac7))
* **tauri:** reap the server on handshake failure; make start_server ([3499058](https://github.com/bloodworks-io/phlox/commit/3499058f5924a0872f730662ba526134ebdb5277))
* **ui:** resolve Maximum update depth loop on New Note ([63eae52](https://github.com/bloodworks-io/phlox/commit/63eae527f1758559b309b08f51e07217b21ec7d0))
* **ui:** save patient demographics ([f98d50f](https://github.com/bloodworks-io/phlox/commit/f98d50fa15b5f2b5ae4049a9d9ddf0594d62e0a0))
* **ui:** search and toast feedback ([364a4c4](https://github.com/bloodworks-io/phlox/commit/364a4c4a025f28692b9c7f358e971cfc712c6f24))
* **ui:** stop misreporting server-startup failures; retry re-warms ([2d2249a](https://github.com/bloodworks-io/phlox/commit/2d2249aee5cf1c88ce92fd98b72cbc2a6b099a05))

## [1.0.5](https://github.com/bloodworks-io/phlox/compare/v1.0.4...v1.0.5) (2026-06-04)


### Bug Fixes

* use single LLM call for visual document processing to prevent timeouts ([83bb6cd](https://github.com/bloodworks-io/phlox/commit/83bb6cda907cb79f2dc4c417213b6b0d7e3c850d))

## [1.0.4](https://github.com/bloodworks-io/phlox/compare/v1.0.3...v1.0.4) (2026-06-01)


### Bug Fixes

* harden CI build workflow security and disable draft releases ([7be7049](https://github.com/bloodworks-io/phlox/commit/7be70499ca816517356415fd65dcfe6db4476af5))

## [1.0.3](https://github.com/bloodworks-io/phlox/compare/v1.0.2...v1.0.3) (2026-06-01)


### Bug Fixes

* update stale /new-patient route references to /new-note ([9851a95](https://github.com/bloodworks-io/phlox/commit/9851a951e9f10d20f6bc4142ff932fb01805c2ad))

## [1.0.2](https://github.com/bloodworks-io/phlox/compare/v1.0.1...v1.0.2) (2026-05-31)


### Bug Fixes

* **ci:** fix release-please version bumping ([0189edb](https://github.com/bloodworks-io/phlox/commit/0189edbfab158aa0e94aa7672243d1f7f7d3f1b7))
* ruff check ([2d6cb2b](https://github.com/bloodworks-io/phlox/commit/2d6cb2bdf250ecf5f8c8e8fddd83bfd8ff5119b9))

## [1.0.1](https://github.com/bloodworks-io/phlox/compare/v1.0.0...v1.0.1) (2026-05-31)


### Bug Fixes

* **deps:** bump deps; remove clear-text logging in chat engine ([394795f](https://github.com/bloodworks-io/phlox/commit/394795f1cd7b3e15228fddb1aade8d46e90f075d))

## [1.0.0](https://github.com/bloodworks-io/phlox/compare/v0.11.0...v1.0.0) (2026-05-31)


### ⚠ BREAKING CHANGES

* **deps:** remove icalendar dependency
* remove unused landing components, RSS system, and reasoning scheduler

### Features

* add pubmed, wikipedia tools; centralise tool calling; add streaming accumulator ([a8166a2](https://github.com/bloodworks-io/phlox/commit/a8166a2a4ad8baf931333465329e3fc42479311c))
* add settings-driven hybrid document/chat/RAG processing with vision capability probing, direct visual LLM flows, and OCR fallback paths ([0fdbc57](https://github.com/bloodworks-io/phlox/commit/0fdbc579b3392241be02988fe3866850a93170b2))
* filter sensitive data from MCP servers toggle ([b191e00](https://github.com/bloodworks-io/phlox/commit/b191e00003bb49d9c29831cf86da7a001a5aa7f1))
* image upload endpoint ([3b67fc2](https://github.com/bloodworks-io/phlox/commit/3b67fc2dd8976d2e4f230e84e9f470a545a2f7e5))
* initial implementation of agent dashboard ([745aa5d](https://github.com/bloodworks-io/phlox/commit/745aa5d1ce9ea62317277f6752dc932a5d926c6d))
* initial mcp implementation ([f0c3ed1](https://github.com/bloodworks-io/phlox/commit/f0c3ed126970e87b45c10a9f4ac69f2efa21daea))
* interleaved thinking/tool calling ([7794b1c](https://github.com/bloodworks-io/phlox/commit/7794b1ccc208563dcde7b29645557732c63cde27))
* new tools for listing outstanding jobs, completing jobs, searching notes ([5c752fa](https://github.com/bloodworks-io/phlox/commit/5c752fabae39ac7c31f42c2a5c11b152f8a2cbf1))
* reasoning can call tools ([7afbef9](https://github.com/bloodworks-io/phlox/commit/7afbef950055a10f7cd5c2cf4d69e84ab3c63884))


### Bug Fixes

* add style example to document processing ([38ce3c1](https://github.com/bloodworks-io/phlox/commit/38ce3c1c2ef5f444165d7ff78d5ba1bb2ac690d2))
* chat logic not wired correctly in tauri ([c87aa2a](https://github.com/bloodworks-io/phlox/commit/c87aa2adec6a13b96dbcf85f14497234bc892927))
* citations with new tool format in chat ([db5b9bf](https://github.com/bloodworks-io/phlox/commit/db5b9bf308e28b7ef820d9b0ea9d2a4b14890c9a))
* debounce endpoints still not working properly ([ccfcb26](https://github.com/bloodworks-io/phlox/commit/ccfcb26b066b1723134e4377c043be5623f5074f))
* debounce llm and whisper URL settings input ([91bffd4](https://github.com/bloodworks-io/phlox/commit/91bffd48cd70f3e23a3535a8ccdf1ef6355b9c8c))
* preserve UTF-8 characters (addresses [#113](https://github.com/bloodworks-io/phlox/issues/113)) ([4c061ae](https://github.com/bloodworks-io/phlox/commit/4c061ae98116474f1583a3bcb025f194de2988ed))
* resolve ~150 ruff lint errors across server codebase ([ae85e19](https://github.com/bloodworks-io/phlox/commit/ae85e193b95ef397de0ac850556b4f05059a1e64))
* rewire file upload for transcription ([bf15d51](https://github.com/bloodworks-io/phlox/commit/bf15d51798a395045f717fb5d50b99b8bea22e83))
* **security:** pin uv image, remove dead deps, update lockfiles ([9f63c1d](https://github.com/bloodworks-io/phlox/commit/9f63c1d416ddb277879b15f0bea0919b08df77ad))
* **security:** remove clear-text PHI logging and error message fixes ([f13e4c9](https://github.com/bloodworks-io/phlox/commit/f13e4c9262638065070712188f02db826cbd0c33))
* **security:** resolve 16 bandit findings across server codebase ([158fd4d](https://github.com/bloodworks-io/phlox/commit/158fd4db58749b003baf9e72ce422a40bbf6ae90))
* server restart calls not working in tauri ([e75499c](https://github.com/bloodworks-io/phlox/commit/e75499c71003708d0b9af48e1c46b70360c816ac))
* **tests:** re-architect stale test suite to resolve collection and runtime failures ([7b04502](https://github.com/bloodworks-io/phlox/commit/7b04502ef1d5a5d1ac2e308ebc323ecbc8ac29de))
* tool calling broke on final round ([7daf128](https://github.com/bloodworks-io/phlox/commit/7daf1283af99b2bed7be6c4dde5744f354161a2a))
* **types:** resolve type errors across codebase ([d184198](https://github.com/bloodworks-io/phlox/commit/d184198aa4a8a42d51d48a3cf453b6d3c3b7334b))
* **ui:** dark/light mode inconsistency ([45e45de](https://github.com/bloodworks-io/phlox/commit/45e45de72746d688df9d9399d37a086341825dd9))
* **ui:** dashboard collapse dimensions ([b2fb5c8](https://github.com/bloodworks-io/phlox/commit/b2fb5c86296d3d8e33c2edf305861527c3fd0384))
* **ui:** render page immediately instead of blocking on slow external endpoints. ([c6733f2](https://github.com/bloodworks-io/phlox/commit/c6733f2f3067b6136581cade3be2f08a6f8bab59))
* various tool calling fixes ([31f18b1](https://github.com/bloodworks-io/phlox/commit/31f18b1167d479f5ceb931ad7b075f1821e58f35))


### Miscellaneous Chores

* **deps:** remove icalendar dependency ([4823578](https://github.com/bloodworks-io/phlox/commit/48235788310277c99ad1b92f47f126ed65979acd))
* remove unused landing components, RSS system, and reasoning scheduler ([5cb0ae4](https://github.com/bloodworks-io/phlox/commit/5cb0ae484b4ddd6bd41dd072fa4b8d9938a32432))

## [0.11.0](https://github.com/bloodworks-io/phlox/compare/v0.10.2...v0.11.0) (2026-03-13)


### Features

* full previous note now appears in the previous visit panel ([4a43ddc](https://github.com/bloodworks-io/phlox/commit/4a43ddcaff25389e2319c1bbf80f8b943b3e9c85))


### Bug Fixes

* debounce job list updates ([79fba1e](https://github.com/bloodworks-io/phlox/commit/79fba1e9784e858f2b155a45cbef28894fed032f))
* empty header error ([49a5066](https://github.com/bloodworks-io/phlox/commit/49a50662815c035acb9cbc3790d53e64c3778d94))
* generated template collision issues ([371df90](https://github.com/bloodworks-io/phlox/commit/371df90c141cb17f97f33a80ec74039bfdf77a79))
* process syntax ([bdf2bf3](https://github.com/bloodworks-io/phlox/commit/bdf2bf3039683e3d338e01da8953242457a320dd))
* service status indicator in tauri builds not working correctly ([b41b6c8](https://github.com/bloodworks-io/phlox/commit/b41b6c8e2016ccdb0fa7ae2a23dd383fa70c6ca8))

## [0.10.2](https://github.com/bloodworks-io/phlox/compare/v0.10.1...v0.10.2) (2026-03-04)


### Bug Fixes

* users unable to switch back to local models ([62652dd](https://github.com/bloodworks-io/phlox/commit/62652ddb555c069cd188fe9ddc673f7175d5694b))

## [0.10.1](https://github.com/bloodworks-io/phlox/compare/v0.10.0...v0.10.1) (2026-03-04)


### Bug Fixes

* CORS issue on local build ([cbebe27](https://github.com/bloodworks-io/phlox/commit/cbebe27593dc3873b905dfcff8d6aeeae68b674b))

## [0.10.0](https://github.com/bloodworks-io/phlox/compare/v0.9.7...v0.10.0) (2026-03-03)


### Features

* add tokens for desltop server ([6d08b23](https://github.com/bloodworks-io/phlox/commit/6d08b23eab2c3d22e47a0aff8442d4f4a0c7be73))
* security middlewares ([d9e25f9](https://github.com/bloodworks-io/phlox/commit/d9e25f98313984d19c1fc239dfe034338246d607))
* template change fetches latest encounter with that template ([60d7208](https://github.com/bloodworks-io/phlox/commit/60d7208cd2dd8ce20a1c9f42b7b6b5c1e4d172d8))


### Bug Fixes

* 404 when no analysis available ([2864223](https://github.com/bloodworks-io/phlox/commit/2864223ce4e5c9fb3bfdf47990d2516eaccd3c85))
* avoid naming collision with llama and whisper binaries ([2bb8801](https://github.com/bloodworks-io/phlox/commit/2bb8801b821e761c02c3d11518595703e3575afe))
* combine system messages into one ([86266af](https://github.com/bloodworks-io/phlox/commit/86266af5b16e934c93dd1e3b0cebf91a0fa6c193))
* CSP ([a2715d6](https://github.com/bloodworks-io/phlox/commit/a2715d62e3880e2c3803b4b6deea4b7378dbb3f6))
* local bearer auth ([725fb50](https://github.com/bloodworks-io/phlox/commit/725fb508d54b8d3dac15dbadafa7898ea8960147))
* macos button positioning ([05eb266](https://github.com/bloodworks-io/phlox/commit/05eb266df0d9721ecab566f222cae1f60d66d172))
* made template generation more robus ([5d97dc3](https://github.com/bloodworks-io/phlox/commit/5d97dc3f5868ee58a0ee633bcae11f75e306f5d5))
* refresh db singleton in dev mode ([b7d33cf](https://github.com/bloodworks-io/phlox/commit/b7d33cfe5cc5732063ace9dbe0f0ebbb1b1b1bbe))
* response format should be a dict ([718f72f](https://github.com/bloodworks-io/phlox/commit/718f72ffbfe5205148a3f2809f849ad1993a04a4))
* response format structure ([08c0dff](https://github.com/bloodworks-io/phlox/commit/08c0dffcd76664ea3d67f6a443c58c5bc1c48272))
* system messages appearing after user messages ([44dca49](https://github.com/bloodworks-io/phlox/commit/44dca4924c2838ab45309ff09187d26f62e707b8))
* tauri CORS issue ([97c3ffa](https://github.com/bloodworks-io/phlox/commit/97c3ffab7f2328d327adf25f74f4f491a4ae3c17))
* update template versioning, new templates ([d9b30ba](https://github.com/bloodworks-io/phlox/commit/d9b30baa25f1555b274c5ddaf92a93de357feb5d))
* zip path traversal ([1be0242](https://github.com/bloodworks-io/phlox/commit/1be02422888eab274828baa2f2e29ea491afefa0))

## [0.9.7](https://github.com/bloodworks-io/phlox/compare/v0.9.6...v0.9.7) (2026-02-23)


### Bug Fixes

* docker deployments were binding to container loopback ([53a796b](https://github.com/bloodworks-io/phlox/commit/53a796b92f41630e9c3fc92575441d4f3d29061f))

## [0.9.6](https://github.com/bloodworks-io/phlox/compare/v0.9.5...v0.9.6) (2026-02-22)


### Bug Fixes

* tauri; llama.cpp libs ([def0f74](https://github.com/bloodworks-io/phlox/commit/def0f74595d52fb2f4972befd30f401fa8d1a2a4))
* tauri; llama.cpp libs ([8e65a43](https://github.com/bloodworks-io/phlox/commit/8e65a4312f5483de806c7ccf4cc3b888f1426854))

## [0.9.5](https://github.com/bloodworks-io/phlox/compare/v0.9.4...v0.9.5) (2026-02-21)


### Bug Fixes

* changelog.md path for backend ([60b0662](https://github.com/bloodworks-io/phlox/commit/60b06627d83c8798628b077f69ccef3bf78aab03))
* disclaimer not showing on web deployments ([2bb0eb7](https://github.com/bloodworks-io/phlox/commit/2bb0eb70530f0671e9cf0f033efdb94d1ae39141))
* generate reasoning prefill error ([d5150e2](https://github.com/bloodworks-io/phlox/commit/d5150e22c29af156f793e98b7fd8a70d23959125))
* llama dylibs ([5dec60e](https://github.com/bloodworks-io/phlox/commit/5dec60e0f4d09009d628e09e1910c04d7ab652aa))
* macos microphone entitlements ([0639859](https://github.com/bloodworks-io/phlox/commit/0639859c82d8fcb5afc65a88cc7658c2a1143e2b))
* reset audio blob when re-recording ([b1f61fb](https://github.com/bloodworks-io/phlox/commit/b1f61fb368b5b44cc88eafbcc3cb2bbc1359b274))
* timeout issue with landing page toast ([012e1d8](https://github.com/bloodworks-io/phlox/commit/012e1d8ec1dce902f5d518c4ae9d308ed27cafaf))
* transcript panel not closing on new transciption ([c813763](https://github.com/bloodworks-io/phlox/commit/c813763ac6c4cc004361b7dbaf7c59c98a8afdff))

## [0.9.4](https://github.com/bloodworks-io/phlox/compare/v0.9.3...v0.9.4) (2026-02-20)


### Bug Fixes

* modal disclaimer page ([1378232](https://github.com/bloodworks-io/phlox/commit/1378232a2a80f3b6cd751d4a1c4022cb7ba2ef36))
* splash screen ([9adc530](https://github.com/bloodworks-io/phlox/commit/9adc5309c52a99ff3b68a75c3d4cb22580bc81a7))
* tauri build issue ([39803ab](https://github.com/bloodworks-io/phlox/commit/39803ab5144b84de8539f4540edd13c69859f4ed))

## [0.9.3](https://github.com/bloodworks-io/phlox/compare/v0.9.2...v0.9.3) (2026-02-19)


### Bug Fixes

* critical reasoning alert not appearing ([15610f0](https://github.com/bloodworks-io/phlox/commit/15610f067c248d5627f393ea668b51915c05b814))

## [0.9.2](https://github.com/bloodworks-io/phlox/compare/v0.9.1...v0.9.2) (2026-02-19)


### Bug Fixes

* previous visit panel ([03683de](https://github.com/bloodworks-io/phlox/commit/03683de1b1c0e46b8e89427c3e6e53158b8325d7))
* reasoning layout and schema ([81d7a44](https://github.com/bloodworks-io/phlox/commit/81d7a44f9e792613ab3c76d11af4635bce9e4bfc))
* tauri internal window reference ([c40b56a](https://github.com/bloodworks-io/phlox/commit/c40b56ae6a6ca81798ce6ce6eedf4b003f93c0e2))
* various UI fixes ([46fd7a4](https://github.com/bloodworks-io/phlox/commit/46fd7a466a8be1cbc0617f1d0aa7a14e54e94c46))

## [0.9.1](https://github.com/bloodworks-io/phlox/compare/v0.9.0...v0.9.1) (2026-02-18)


### Bug Fixes

* assume yes for nuitka downloads in CI ([e8a84ec](https://github.com/bloodworks-io/phlox/commit/e8a84ecef8370aaed71b047c8058af5cdcfb42e2))

## [0.9.0](https://github.com/bloodworks-io/phlox/compare/v0.8.0...v0.9.0) (2026-02-18)


### Features

* backup db prior to migration ([eda6757](https://github.com/bloodworks-io/phlox/commit/eda6757122ec92b28355a39f3cae65bfbc36c940))
* cohesive text area appearance ([9a1bda8](https://github.com/bloodworks-io/phlox/commit/9a1bda8ff82364799fd66865f8c365ca9e6e4fdf))
* deduplication module ([5cfb2e8](https://github.com/bloodworks-io/phlox/commit/5cfb2e8b54013a8677cfcf0bd191faf3343c488c))
* improved reasoning display ([0e9ab49](https://github.com/bloodworks-io/phlox/commit/0e9ab49797fda9c8f6a9b2bf3cda5ce6bfc851a4))
* non-blocking summarisation requests ([8b20317](https://github.com/bloodworks-io/phlox/commit/8b20317b7d6567694add7510882055c3eea7c6a5))
* overhauled action buttons and recording widget ([028a52b](https://github.com/bloodworks-io/phlox/commit/028a52bd6d0267fbadc2c65111c496acb6844cb8))
* process-manager to co-ordinate services ([41227f6](https://github.com/bloodworks-io/phlox/commit/41227f605daf0ebeab9fc29665b597d1c4e008a9))
* Server startup loader ([68cd80e](https://github.com/bloodworks-io/phlox/commit/68cd80e4651ec2f12a3f4acb91747e8aab1555bc))
* tauri desktop build, local inference, and major refactor ([dd67917](https://github.com/bloodworks-io/phlox/commit/dd679178156af07c9390ade5682f4e903e473c1d))


### Bug Fixes

* changelog path ([dfb40fa](https://github.com/bloodworks-io/phlox/commit/dfb40fa4ed2f98b39497b9ab38fd7fa4443779a1))
* drag area in Tauri ([2ec7be7](https://github.com/bloodworks-io/phlox/commit/2ec7be778074cc393dba9ff20b46e6dc49e80354))
* fixed model recommendations ([4883f2c](https://github.com/bloodworks-io/phlox/commit/4883f2c857bca85f5e74b9d958cf576edbadb8e3))
* improved wrong key detection; async server launch ([41adeee](https://github.com/bloodworks-io/phlox/commit/41adeeea9d7c7939073b18724be821328fe5025a))
* imrpovements to Dictate mode ([f815ceb](https://github.com/bloodworks-io/phlox/commit/f815cebeabb47d739afc9a48d8110dbc03646aae))
* initialize demo db correctly ([796aa02](https://github.com/bloodworks-io/phlox/commit/796aa022212cd81037d5b575070fafb40ab4f671))
* patient templates not refreshing for historical encounters ([1a4127c](https://github.com/bloodworks-io/phlox/commit/1a4127c271d6832735f723723c548ab1aa73e4af))
* process manager fixes ([d00cbb6](https://github.com/bloodworks-io/phlox/commit/d00cbb65970657b15f477dd6f8450f1fd46a1f09))
* reasoning improvements ([d03b021](https://github.com/bloodworks-io/phlox/commit/d03b0210eb76ac462fe72bcf48d283311ea64824))
* remove chat items from Tauri build ([642f117](https://github.com/bloodworks-io/phlox/commit/642f117e6383e5fd7286b632c7890e0e1abf1141))
* rss url validation ([d956ed8](https://github.com/bloodworks-io/phlox/commit/d956ed8a9de4f786628d24adee75ce4db6ad0987))
* set up uv venv and install nuitka before build in CI ([be0486c](https://github.com/bloodworks-io/phlox/commit/be0486c34dbca6a38dfb5b7ae56cdb59559333bb))
* sync reasoning and primary model ([5de99df](https://github.com/bloodworks-io/phlox/commit/5de99df3d2b4bc7571ff1cbc0d80da15a4a676fe))
* update reasoning schema ([9722b07](https://github.com/bloodworks-io/phlox/commit/9722b0766e7661a2346abb26eb2528758746fe1f))
* warm up server first ([ad8cf0d](https://github.com/bloodworks-io/phlox/commit/ad8cf0d2a2f8c1980ad4affcb90782b71803f231))

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
