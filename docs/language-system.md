# AI Show Language System

## Overview

The AI Show now features a comprehensive, modular language system that supports 30+ languages out of the box. This system replaces all hardcoded language detection with a centralized, configurable approach.

## Supported Languages

### Currently Supported (30+ Languages)

| Code | Language | Native Name | Status |
|------|----------|-------------|--------|
| `en` | English | English | ✅ Default |
| `ko` | Korean | 한국어 | ✅ |
| `ch` | Chinese (Simplified) | 中文 (简体) | ✅ |
| `es` | Spanish | Español | ✅ |
| `fr` | French | Français | ✅ |
| `de` | German | Deutsch | ✅ |
| `it` | Italian | Italiano | ✅ |
| `pt` | Portuguese | Português | ✅ |
| `ru` | Russian | Русский | ✅ |
| `ja` | Japanese | 日本語 | ✅ |
| `zh` | Chinese (Traditional) | 中文 (繁體) | ✅ |
| `ar` | Arabic | العربية | ✅ |
| `hi` | Hindi | हिन्दी | ✅ |
| `th` | Thai | ไทย | ✅ |
| `vi` | Vietnamese | Tiếng Việt | ✅ |
| `tr` | Turkish | Türkçe | ✅ |
| `pl` | Polish | Polski | ✅ |
| `nl` | Dutch | Nederlands | ✅ |
| `sv` | Swedish | Svenska | ✅ |
| `no` | Norwegian | Norsk | ✅ |
| `da` | Danish | Dansk | ✅ |
| `fi` | Finnish | Suomi | ✅ |
| `cs` | Czech | Čeština | ✅ |
| `hu` | Hungarian | Magyar | ✅ |
| `ro` | Romanian | Română | ✅ |
| `he` | Hebrew | עברית | ✅ |
| `id` | Indonesian | Bahasa Indonesia | ✅ |
| `ms` | Malay | Bahasa Melayu | ✅ |
| `tl` | Filipino | Filipino | ✅ |
| `sw` | Swahili | Kiswahili | ✅ |

## Architecture

### Core Components

1. **LanguageConfig** (`Assets/Scripts/Configuration/LanguageConfig.cs`)
   - ScriptableObject that defines all supported languages
   - Contains language codes, names, aliases, and translation prompts
   - Centralized configuration for the entire system

2. **LanguageService** (`Assets/Scripts/Services/LanguageService.cs`)
   - Static service for language code normalization
   - Replaces all hardcoded language detection patterns
   - Provides consistent language resolution across the codebase

3. **Updated Components**
   - `ShowrunnerManager` - Now uses dynamic language lists
   - `MetadataFixer` - Generic language code detection
   - `ShowrunnerSpeakerElevenLabs` - Modular language path generation
   - `YouTubeTranscriptGenerator` - Extensible language support
   - `YouTubeMetadataGenerator` - Expanded language mapping
   - `EpisodeProcessorCLI` - Language-specific CLI flags

### File Path Generation

All file paths now use consistent language codes:

```
Episodes/
  └── 2025-01-15/
      ├── recordings/
      │   ├── 2025-01-15_en_20250115_143022.mp4
      │   ├── 2025-01-15_ko_20250115_143022.mp4
      │   └── 2025-01-15_es_20250115_143022.mp4
      ├── audio/
      │   ├── en/
      │   ├── ko/
      │   └── es/
      ├── transcript/
      │   ├── aipodcast_2025-01-15_youtubetranscript_en.txt
      │   ├── aipodcast_2025-01-15_youtubetranscript_ko.txt
      │   └── aipodcast_2025-01-15_youtubetranscript_es.txt
      ├── metadata/
      │   ├── aipodcast_2025-01-15_youtube_metadata_en.json
      │   ├── aipodcast_2025-01-15_youtube_metadata_ko.json
      │   └── aipodcast_2025-01-15_youtube_metadata_es.json
      └── thumbnail/
          ├── thumbnail_en.jpg
          ├── thumbnail_ko.jpg
          └── thumbnail_es.jpg
```

## Setup Instructions

### 1. Create Language Configuration

In Unity Editor:
```
AI Show → Create Language Configuration
```

This creates `Assets/Resources/LanguageConfig.asset` with all 30+ languages pre-configured.

### 2. Customize Languages (Optional)

Select the LanguageConfig asset and customize:
- Enable/disable specific languages
- Modify translation prompts
- Add new language aliases
- Set default language

### 3. Validate Configuration

```
AI Show → Validate Language Configuration
```

## Usage

### CLI Commands

#### List All Supported Languages
```bash
Unity.exe -batchmode -quit -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.ProcessEpisodeFromCommandLine -listLanguages
```

#### Show Enabled Languages
```bash
Unity.exe -batchmode -quit -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.ProcessEpisodeFromCommandLine -enabledLanguages
```

#### Generate Specific Languages
```bash
Unity.exe -batchmode -quit -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.ProcessFlexibleBatchFromCommandLine -generate -record -languages "en,ko,es,fr"
```

### ShowrunnerManager Configuration

In the Unity Inspector:
1. Select your ShowrunnerManager GameObject
2. In "Translation Settings" → "Target Language Codes"
3. Add language codes: `en`, `ko`, `es`, `fr`, etc.

### Adding New Languages

1. Open `Assets/Resources/LanguageConfig.asset`
2. Expand "Supported Languages"
3. Add new language entry:
   - **Code**: 2-letter ISO code (e.g., `pt`)
   - **Name**: English name (e.g., `Portuguese`)
   - **Display Name**: Native name (e.g., `Português`)
   - **Aliases**: Alternative names (e.g., `portuguese`, `portugues`)
   - **Translation Prompt**: LLM instructions for this language
   - **Is Enabled**: ✅ Check to enable

## Migration from Old System

### Before (Hardcoded)
```csharp
// Old hardcoded approach
string langCode = "en";
if (lang == "ko" || lang == "korean") langCode = "ko";
else if (lang == "ch" || lang == "chinese") langCode = "ch";
```

### After (Modular)
```csharp
// New modular approach
string langCode = LanguageService.NormalizeLanguageCode(episode.language);
```

The new system is backwards compatible - existing "en", "ko", "ch" files continue to work.

## Benefits

1. **Easy Language Addition**: Add new languages via configuration, no code changes
2. **Consistent File Naming**: All components use the same language codes
3. **CLI Language Selection**: Specify any combination of languages
4. **Backwards Compatible**: Existing 3-language setup continues working
5. **Robust Fallbacks**: Handles typos, alternative names, etc.
6. **Centralized Configuration**: One place to manage all language settings

## Troubleshooting

### Language Not Recognized
1. Check if language is enabled in LanguageConfig
2. Verify language code/alias spelling
3. Use `AI Show → Validate Language Configuration`

### File Path Issues
1. Ensure LanguageService is initialized
2. Check language code normalization
3. Verify PathUtility is using correct codes

### CLI Issues
1. Use `-listLanguages` to see available options
2. Check language code format: comma-separated, no spaces
3. Example: `-languages "en,ko,es"` not `-languages "en, ko, es"`

## Future Enhancements

- [ ] Integration with LanguageService throughout codebase
- [ ] Voice model mapping per language
- [ ] Region-specific variants (e.g., `en-US`, `en-GB`)
- [ ] RTL language support for Arabic/Hebrew
- [ ] Language-specific cultural adaptations 