### Summary of Pipeline Fixes and Enhancements (2025-06-28)

Today's session focused on resolving critical inconsistencies in the automated episode generation and deployment pipeline. We systematically addressed bugs and added new functionality to improve robustness and fully automate the workflow.

#### 1. YouTube Metadata Sanitization and Formatting
The initial metadata generation process was updated to produce clean, YouTube-compliant JSON files from the start.

-   **Flattened JSON Structure**: Removed the `episode_metadata` wrapper for a cleaner, root-level structure.
-   **Field Cleanup**: Deleted the obsolete `duration` and `generated_at` fields.
-   **Corrected Privacy Status**: The `privacy_status` is now hardcoded to `unlisted` to prevent incorrect Inspector settings from causing issues.
-   **Automated Playlist IDs**: Implemented a robust, code-driven mapping for language-specific playlist IDs (`en`, `ch`, `ko`), with a configurable default fallback.
-   **Title and Description Sanitization**: Added logic to prepend the date to titles, ensure they are under 100 characters, and remove the source URL from descriptions.
-   **Tag Formatting**: Corrected the tag output to use single commas (`tag1,tag2,tag3`) as required by YouTube, instead of comma-space separation.

#### 2. Language Processing and Filename Consistency
We resolved a series of bugs that caused incorrect language handling and inconsistent file naming.

-   **Base Language Identification**: The `ShowrunnerManager` now correctly identifies the first language in the CLI `-languages` list as the base language for generation, rather than assuming English.
-   **Translation Logic Fix**: Corrected the translation loop to only process target languages, preventing the system from trying to "translate English to English" and causing API errors. The `LanguageService` is now properly used to fetch full language names (e.g., "Korean") for the translation provider.
-   **Consistent `_en` Suffix**: Modified the `ShowRecorder` to ensure the English version of the `.mp4` video is always saved with the `_en` suffix, matching the convention used for all other generated files (`.json`, `.txt`). This fixed the downstream `MetadataFixer` workflow.

#### 3. Fully Automated SCP Upload
To complete the "generate and deploy" loop, we added a new, fully-automated upload step at the end of the batch process.

-   **Synchronous Operation**: The system now waits for the `scp` upload to complete successfully before initiating the final Unity shutdown sequence, ensuring the file is fully transferred. Progress from the `scp` command is logged to the console for real-time feedback.

This session successfully hardened the automation pipeline, eliminated several critical bugs, and closed the final gap in the automated workflow. 