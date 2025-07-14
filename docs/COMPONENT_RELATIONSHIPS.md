# Component Relationship Documentation

**Purpose**: Reference for LLM agents to understand component dependencies, data flow, and integration patterns.

## Core System Architecture

### Central Hub: ShowRunner
**File**: `Assets/Scripts/ShowRunner/ShowRunner.cs`

The ShowRunner acts as the central orchestrator with direct dependencies on:

| Component | File Path | Relationship Type | Description |
|-----------|-----------|------------------|-------------|
| EventProcessor | `Assets/Scripts/ShowRunner/EventProcessor.cs` | Direct Reference | Processes events for dialogue, scenes, and MIDI |
| ScenePreparationManager | `Assets/Scripts/ShowRunner/ScenePreparationManager.cs` | Direct Reference | Manages asynchronous scene loading |
| SceneTransitionManager | `Assets/Scripts/ShowRunner/SceneTransitionManager.cs` | Direct Reference | Handles scene transitions |
| ShowRunnerUI | `Assets/Scripts/ShowRunner/ShowRunnerUI.cs` | Direct Reference | User interface integration |
| AudioSource | Unity Built-in | Direct Reference | Default audio playback |

### Data Flow Patterns

#### 1. Episode Playback Flow
```
ShowRunner → EventProcessor → [Scene/Dialogue/Effects]
     ↓
ShowRunnerUI ← State Updates ← ShowRunner
```

#### 2. Scene Preparation Flow  
```
ShowRunner → ScenePreparationManager → Scene Loading
     ↓
OnScenePreparationComplete → ShowRunner
```

#### 3. Event Processing Flow
```
ShowRunner → EventProcessor → ProcessEvent()
     ↓
EventProcessor → [Effects Components] → Actor GameObjects
```

## Component Dependency Matrix

### Required Dependencies (Hard Dependencies)

| Component | Requires | File Location | Notes |
|-----------|----------|---------------|-------|
| EventProcessor | ScenePreparationManager | `Assets/Scripts/ShowRunner/ScenePreparationManager.cs` | [RequireComponent] |
| BigHeadEffect | BigHeadMode | `Assets/Scripts/Utilities/BigHeadMode.cs` | [RequireComponent] |

### Optional Dependencies (Soft Dependencies)

| Component | May Use | File Location | Fallback Behavior |
|-----------|---------|---------------|-------------------|
| EventProcessor | SpeakPayloadManager | `Assets/Scripts/ShowRunner/SpeakPayloadManager.cs` | Graceful degradation |
| EventProcessor | ShowRecorder | `Assets/Scripts/Utilities/ShowRecorder.cs` | Skips logging |
| EventProcessor | Various Effects | `Assets/Scripts/Effects/` | No visual effects |

## Event System Relationships

### ShowRunner Events (Publishers)
- `OnLastDialogueComplete` → EpisodeCompletionNotifier, UXAnimationManager
- `OnEpisodeSelectedForDisplay` → ShowRunnerUI, Display Systems  
- `OnEpisodeActualStart` → Recording Systems, Analytics
- `OnSceneChangedForDisplay` → UI Updates, Background Systems

### EventProcessor Events (Publishers)
- `OnSpeakEventProcessed` → Audio Systems, Animation Systems
- `OnMidiEventProcessed` → Music Systems, Effect Systems

## Effect System Relationships

### Actor Effect Dependencies
When EventProcessor processes "speak" events with actions:

| Action Type | Target Component | File Location |
|-------------|------------------|---------------|
| excited | ExcitedEffect | `Assets/Scripts/Effects/ExcitedEffect.cs` |
| happy | HappyEffect | `Assets/Scripts/Effects/HappyEffect.cs` |
| concerned | ConcernedEffect | `Assets/Scripts/Effects/ConcernedEffect.cs` |
| laugh | LaughEffect | `Assets/Scripts/Effects/LaughEffect.cs` |
| amused | AmusedLazerEffect | `Assets/Scripts/Effects/AmusedLazerEffect.cs` |
| spazz | GlitchOutEffect | `Assets/Scripts/Effects/GlitchOutEffect.cs` |
| bighead_* | BigHeadEffect | `Assets/Scripts/Effects/BigHeadEffect.cs` |

### Effect Component Dependencies
| Effect | Requires | File Location | Purpose |
|--------|----------|---------------|---------|
| GlitchOutEffect | LookAtLogic | TBD | Sway/lean parameters |
| GlitchOutEffect | GlitchSoundEffect | `Assets/Scripts/Effects/GlitchSoundEffect.cs` | Audio feedback |
| GlitchOutEffect | ParticleSystemController | TBD | Visual particles |
| BigHeadEffect | BigHeadMode | `Assets/Scripts/Utilities/BigHeadMode.cs` | Head scaling logic |

## UI System Relationships

### ShowRunnerUI Dependencies
| Component | File Location | Relationship |
|-----------|---------------|--------------|
| ShowRunner | `Assets/Scripts/ShowRunner/ShowRunner.cs` | Main controller reference |
| ShowRunnerUIContainer | `Assets/Scripts/ShowRunner/ShowRunnerUIContainer.cs` | UI element container |
| TextMeshPro | Unity Package | Text display |
| UnityEngine.UI | Unity Built-in | UI components |

### UI Communication Pattern
```
User Input → ShowRunnerUI → ShowRunner → [System Updates] → ShowRunnerUI (State Updates)
```

## Data Structure Relationships

### ShowData Hierarchy
```
ShowData (Assets/Scripts/ShowRunner/ShowData.cs)
├── ShowConfig
│   ├── ActorConfig[]
│   └── LocationConfig[]
└── Episode[]
    └── Scene[]
        └── Dialogue[]
```

### Integration Points
| System | Uses ShowData For | Access Pattern |
|--------|-------------------|----------------|
| ShowRunner | Episode playback | Direct access via GetShowData() |
| ShowDataSerializer | Save/Load | Serialization/Deserialization |
| ShowValidator | Data validation | Structure validation |
| EventProcessor | Dialogue processing | Via ShowRunner events |

## Initialization Order Requirements

### Critical Initialization Sequence
1. **ShowRunner.Awake()** - Singleton setup, component validation
2. **EventProcessor.Awake()** - Finds ScenePreparationManager  
3. **ShowRunnerUI.Start()** - Event listener setup
4. **ShowRunner.DiscoverShowFiles()** - Discovers available shows
5. **UI Population** - Dropdowns populated with discovered data

### Component Validation Points
- ShowRunner validates required components in Awake()
- EventProcessor checks for ScenePreparationManager
- BigHeadEffect validates BigHeadMode presence
- Effects validate target GameObjects before triggering

## Performance Considerations

### High-Frequency Operations
- ShowRunnerUI.Update() - Auto-play timer
- WaypointManager.Update() - Movement calculations  
- RotateSphere.Update() - Rotation transforms

### Resource-Intensive Operations
- Scene loading (asynchronous via ScenePreparationManager)
- Audio loading and playback
- Particle system effects
- Multiple simultaneous character effects

## Integration Patterns for New Components

### To Add a New Effect:
1. Create effect component in `Assets/Scripts/Effects/`
2. Add action handling in `EventProcessor.HandleSpeak()`
3. Ensure graceful fallback if effect component missing
4. Document effect in EventProcessor action list

### To Add New UI Component:
1. Reference ShowRunner for data access
2. Subscribe to relevant ShowRunner events
3. Update ShowRunnerUIContainer if needed
4. Follow existing UI update patterns

### To Add New Event Type:
1. Add case in `EventProcessor.ProcessEvent()`
2. Define EventData structure requirements
3. Add static event if other systems need notification
4. Document in EventProcessor API

This relationship documentation provides LLM agents with the necessary context to understand how components interact, what dependencies exist, and how to properly integrate new functionality into the existing system architecture.