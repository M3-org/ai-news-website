# Headline Translation System

## Overview

The headline translation system automatically extracts, translates, and displays localized headlines during episode generation. It follows the existing LanguageService pattern and integrates seamlessly with the current multilingual pipeline.

## Architecture

### Components

1. **HeadlineData Class** - Data structure for storing headlines
2. **ShowrunnerGeneratorLLM** - Enhanced to extract headlines from external data
3. **ShowrunnerManager** - Added headline translation pipeline
4. **HeadlineScroller** - Enhanced with language-aware loading
5. **PathUtility** - Added headline folder structure support
6. **ShowRunner** - Integrated headline notification system

### File Structure

Headlines are stored in a language-specific folder structure:

```
Assets/Resources/Episodes/{episode-id}/
├── aipodcast_{episode-id}_en.json
├── aipodcast_{episode-id}_ko.json
├── audio/
│   ├── en/
│   └── ko/
├── headlines/
│   ├── headlines_en.json
│   └── headlines_ko.json
└── transcript/
```

## Implementation Details

### HeadlineData Structure

```csharp
[System.Serializable]
public class HeadlineData
{
    public string language;       // Language code (en, ko, ch, etc.)
    public string date;          // Episode date
    public List<string> headlines; // List of headlines
    public string separator = "     "; // Separator for display
}
```

### Headline Extraction

Headlines are intelligently extracted using LLM analysis during episode generation:

1. **Source**: Any structured external data (flexible format support)
2. **Process**: LLM-powered analysis during `FetchExternalDataWithHeadlinesAsync()`
3. **Extraction Logic**: 
   - **Primary**: LLM analyzes entire JSON structure and extracts 8-15 compelling headlines
   - **Intelligent Selection**: Focuses on specific developments, issues, and insights
   - **Adaptive**: Works with any data structure - no hardcoded parsing required
   - **Fallback**: Basic category extraction if LLM call fails
4. **LLM Prompt Requirements**:
   - Extract newsworthy and compelling headlines
   - Focus on concrete developments over general categories
   - 5-15 words per headline for optimal display
   - Return JSON array of strings
5. **Example Data Structures Supported**:
   ```json
   // Current complex structure
   {
     "categories": {
       "github_updates": {
         "new_issues_prs": [
           {"title": "Fix database schema type mismatch", "significance": "..."}
         ]
       },
       "strategic_insights": [
         {"theme": "Shift toward transaction-based tokenomics", "insight": "..."}
       ],
       "technical_challenges": [
         {"issue": "Database connection limits", "details": "..."}
       ]
     }
   }
   
   // Legacy array structure (also supported)
   {
     "categories": [
       {"title": "...", "content": [{"theme_title": "...", "text": "..."}]}
     ]
   }
   ```
6. **Storage**: Saved as base language headlines with LLM-extracted content

### Translation Pipeline

Headlines are translated alongside episodes:

1. **Base Language**: Extracted headlines stored for source language
2. **Translation**: Each headline translated individually for accuracy
3. **Parallel Processing**: Headlines translated simultaneously with episode content
4. **Language Service**: Uses centralized language name resolution

### Display Integration

HeadlineScroller automatically loads appropriate headlines:

1. **Language Detection**: Reads current episode language from ShowRunner
2. **File Loading**: Attempts to load localized headlines first
3. **Fallback**: Falls back to English if localized version unavailable
4. **Legacy Support**: Falls back to HeadlineLoader for older behavior

## Usage

### Automatic Operation

Headlines are automatically processed during standard episode generation:

```csharp
// Headlines are extracted and translated automatically
await showrunnerManager.GenerateEpisodeFromEditor();
```

### Manual Loading

Headlines can be manually loaded for specific episodes:

```csharp
// Load headlines for a specific episode and language
headlineScroller.LoadHeadlinesForEpisode("2025-06-29", "ko");
```

## Configuration

### HeadlineScroller Settings

- `useLocalizedHeadlines`: Enable/disable localized headline loading
- `fallbackLanguage`: Language to use when localized version not found

### Language Support

Headlines support all languages configured in LanguageService:
- English (en) - Base language
- Korean (ko)
- Chinese Simplified (ch)
- And all other enabled languages

## Benefits

1. **Automated**: No manual translation or file management required
2. **Consistent**: Follows established LanguageService patterns
3. **Fallback Support**: Graceful degradation when files missing
4. **Performance**: Parallel translation processing
5. **Maintainable**: Centralized configuration and logic

## Debugging

### Log Messages

The system provides detailed logging:

```
[ShowrunnerManager] Extracted N headlines from external data
[ShowrunnerManager] Translating N headlines to {language} ({code})
[HeadlineScroller] Loaded headlines from: {path}
[ShowRunner] Notified N headline scrollers for episode {id} in language {code}
```

### Common Issues

1. **Missing Headlines**: 
   - Check if LLM endpoint is properly configured and accessible
   - Verify API keys are valid and have sufficient credits
   - Review LLM prompt response in debug logs
2. **LLM Extraction Failures**: 
   - Ensure Claude/LLM API is accessible
   - Check `max_tokens` limit (1000 for headline extraction)
   - Verify external data is valid JSON
3. **Translation Failures**: Verify TranscriptTranslator configuration and API keys
4. **File Not Found**: Ensure episode generation completed successfully
5. **Language Not Supported**: Check LanguageService configuration
6. **Empty Headlines Array**: 
   - LLM may not have found interesting content in the data
   - Check debug logs for LLM response
   - Verify external data contains meaningful content
   - System will fall back to basic category extraction
7. **Poor Quality Headlines**: 
   - Review and adjust the LLM prompt in `BuildHeadlineExtractionPrompt()`
   - Consider different LLM model or temperature settings
   - Check if external data structure provides sufficient context
8. **Fallback Extraction Used**: This indicates LLM extraction failed, check API connectivity and logs

## Future Enhancements

1. **Custom Sources**: Support for additional headline sources
2. **Caching**: Cache frequently accessed headlines
3. **Real-time Updates**: Live headline updates during episode playback
4. **Formatting Options**: Configurable headline display formatting 