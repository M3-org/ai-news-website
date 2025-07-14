# ShowRunner System Documentation

## Overview
The ShowRunner system is a Unity-based framework for managing interactive shows, episodes, and scenes. It provides a robust architecture for loading, playing, and controlling show content with a user-friendly interface.

## Core Components

### 1. ShowRunner
The central controller class that orchestrates the entire show experience.

**Key Responsibilities:**
- Loading and managing show data
- Controlling episode playback
- Handling scene transitions
- Processing events
- Managing show state

**Main Methods:**
- `LoadShowData()`: Loads show content from JSON files
- `SelectEpisode(int index)`: Handles episode selection
- `PrepareScene(string sceneName)`: Manages scene preparation
- `SendSpeakEvent(string actor, string line, string action)`: Controls dialogue
- `PauseShow()`: Pauses the ShowRunner's internal state machine (used by CommercialManager). Does NOT affect Time.timeScale.
- `ResumeShow()`: Resumes the ShowRunner's internal state machine (used by CommercialManager).

### 2. ShowData
Data structures for managing show content.

**Classes:**
- `ShowData`: Root container for show information
- `Episode`: Represents a single episode
- `Scene`: Contains scene-specific data
- `Dialogue`: Manages character dialogue

### 3. ShowRunnerUI
Manages the user interface and user interactions.

**Features:**
- Episode selection dropdown
- Play/Pause controls
- Next scene/dialogue navigation
- Status updates
- Manual/Auto mode switching

### 4. ShowRunnerUIContainer
Container class for UI elements and state management.

### 5. CommercialManager (New)
Handles playback of video commercials between scenes. Pauses/Resumes ShowRunner state.

## Data Flow

1. **Show Loading:**
   ```
   JSON Files -> ShowData -> ShowRunner -> UI Display
   ```

2. **Episode Playback:**
   ```
   User Selection -> ShowRunner -> [Commercial Check & Pause] -> Scene Preparation -> [Commercial Fade Out & Resume] -> Dialogue Processing
   ```

3. **Event Processing:**
   ```
   ShowRunner -> EventProcessor -> ScenePreparationManager -> Scene Loading
   ```

## Scene Preparation

1. **Process:**
   - User selects episode
   - Scene preparation event created
   - Scene loaded asynchronously
   - Intro sequence played
   - Scene activated

2. **Components:**
   - `ScenePreparationManager`: Handles scene loading
   - `EventProcessor`: Processes scene events
   - `IntroSequenceManager`: Manages intro transitions
   - `CommercialManager`: Manages commercial transitions between scenes

## UI System

1. **Components:**
   - Episode dropdown
   - Control buttons (Load, Next, Play/Pause)
   - Status display
   - Scene information

2. **States:**
   - Manual mode: User-controlled progression
   - Auto mode: Automatic playback
   - Loading state
   - Playing state
   - Paused state
   - Commercial Break state (ShowRunner internally paused)

## Event System

1. **Event Types:**
   - `prepareScene`: Scene preparation
   - `speak`: Character dialogue
   - `episodeGenerated`: Episode loading

2. **Processing:**
   - Events created by ShowRunner
   - Processed by EventProcessor
   - Handled by appropriate managers

## Setup and Configuration

1. **Required Components:**
   - ShowRunner GameObject
   - UI Container
   - Event Processor
   - Scene Preparation Manager
   - Commercial Manager (and associated UI/Video components)

2. **JSON Structure:**
   ```json
   {
     "config": {
       "name": "Show Name",
       "actors": { ... }
     },
     "episodes": [
       {
         "id": "episode1",
         "name": "Episode 1",
         "scenes": [ ... ]
       }
     ]
   }
   ```

## Best Practices

1. **Scene Setup:**
   - Include all required components
   - Set up UI references
   - Configure event processors

2. **Content Creation:**
   - Follow JSON schema
   - Include all required fields
   - Validate content before loading

3. **Performance:**
   - Use async loading
   - Manage memory efficiently
   - Handle errors gracefully

## Error Handling

1. **Common Issues:**
   - Missing components
   - Invalid JSON data
   - Scene loading failures
   - UI reference errors

2. **Solutions:**
   - Component validation
   - Data validation
   - Error logging
   - Graceful fallbacks 

## Future Improvements

1. **Potential Enhancements:**
   - Additional UI features
   - More event types
   - Enhanced error handling
   - Performance optimizations

2. **Considerations:**
   - Scalability
   - Maintainability
   - User experience
   - Performance impact 