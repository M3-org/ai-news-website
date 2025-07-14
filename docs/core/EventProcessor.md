# EventProcessor Component

**File:** `Assets/Scripts/ShowRunner/EventProcessor.cs`

## Overview
The EventProcessor is a core component that handles various events in the show system, including scene preparation, dialogue, and character actions. It processes events from the ShowRunner and coordinates with other systems to execute the appropriate actions.

## Dependencies
- `ScenePreparationManager` (`Assets/Scripts/ShowRunner/ScenePreparationManager.cs`) - Required Component
- `SpeakPayloadManager` (`Assets/Scripts/ShowRunner/SpeakPayloadManager.cs`)
- `BigHeadEffect` (`Assets/Scripts/Effects/BigHeadEffect.cs`)
- Various effect systems for character actions

## Public API Reference

### Static Events
- **`static event Action<EventData> OnSpeakEventProcessed`**
  - Triggered when a 'speak' event is processed
  - **Parameters**: `EventData` - The speak event data

- **`static event Action<EventData> OnMidiEventProcessed`**
  - Triggered when a MIDI event is processed
  - **Parameters**: `EventData` - The MIDI event data

### Public Methods
- **`void ProcessEvent(EventData eventData)`**
  - **Parameters**: `eventData` (EventData) - Event data to process
  - Main entry point for processing all event types
  - **Supported Event Types**: "prepareScene", "speak", "midi"

### EventData Structure
Expected properties for the `EventData` parameter:
- **`string type`** - Event type ("prepareScene", "speak", "midi")
- **`string location`** - For prepareScene events
- **`string actor`** - For speak events
- **`string line`** - For speak events
- **`string action`** - For speak events
- **`int midiChannel`** - For midi events
- **`int midiNote`** - For midi events
- **`int midiVelocity`** - For midi events
- **`int midiValue`** - For midi events

## Event Types

### 1. Episode Generated
```csharp
case "episodeGenerated":
    StartCoroutine(HandleEpisodeAndPrepareScene(eventData));
    HandlePrepareScene(eventData);
    break;
```
**Method:** `ProcessEvent()` (`EventProcessor.cs:45`)
- Triggers when a new episode is generated
- Initiates scene preparation
- Includes a delay for processing

### 2. Prepare Scene
```csharp
case "prepareScene":
    HandlePrepareScene(eventData);
    break;
```
- Handles scene preparation requests
- Coordinates with ScenePreparationManager
- Manages scene transitions

### 3. Speak
```csharp
case "speak":
    HandleSpeak(eventData);
    break;
```
- Processes dialogue events
- Handles character actions
- Manages audio playback

## Supported Actor Actions

### Basic Actions
- `wave`, `point`, `normal`, `waving`

### Emotional States
- `excited` - Triggers excited effect
- `happy` - Triggers happy effect  
- `concerned` - Triggers concerned effect
- `laugh` - Triggers laugh effect
- `amused` - Triggers laser effect

### Personality Modes
- `professional`, `confident`, `cool`, `smooth`, `optimistic`, `chill`

### Communication Styles  
- `shouting`, `enthusiastic`, `joking`, `concluding`, `explaining`, `passionate`

### Mental States
- `analyzing`, `technical`, `observing`, `pleased`, `agreeing`, `recovered`, `transitioning`

### Special Effects
- `spazz` - Triggers glitch effect
- `bighead_grow` - Grows character's head
- `bighead_shrink` - Shrinks character's head  
- `bighead_random` - Random head size variation

### API Usage Example
```csharp
var eventData = new EventData 
{
    type = "speak",
    actor = "Character1", 
    line = "Hello world!",
    action = "excited"
};

eventProcessor.ProcessEvent(eventData);
```

## Effect System

### Glitch Effect
```csharp
private void TriggerGlitchEffect(GameObject actorGameObject)
```
- Applies glitch visual effect
- Temporary distortion
- Character-specific application

### Happy Effect
```csharp
private void TriggerHappyEffect(GameObject actorGameObject)
```
- Applies happy visual effect
- Positive emotion display
- Character-specific application

### Concerned Effect
```csharp
private void TriggerConcernedEffect(GameObject actorGameObject)
```
- Applies concerned visual effect
- Worried emotion display
- Character-specific application

### Excited Effect
```csharp
private void TriggerExcitedEffect(GameObject actorGameObject)
```
- Applies excited visual effect
- High energy display
- Character-specific application

### Laugh Effect
```csharp
private void TriggerLaughEffect(GameObject actorGameObject)
```
- Applies laugh visual effect
- Humor display
- Character-specific application

### Amused Effect
```csharp
private void TriggerAmusedEffect(GameObject actorGameObject)
```
- Applies laser visual effect
- Amusement display
- Character-specific application

### Big Head Effect
```csharp
private void TriggerBigHeadEffect(GameObject actorGameObject, BigHeadEffect.EffectMode mode)
```
- Modifies character head size
- Three modes: Grow, Shrink, Random
- Character-specific application

## Best Practices
1. Always validate actor existence before applying effects
2. Use appropriate effect for the intended emotion/action
3. Handle missing components gracefully
4. Log important events for debugging
5. Maintain consistent effect durations

## Error Handling
- Validates actor existence
- Provides fallback for missing effects
- Logs errors for debugging
- Graceful degradation for missing components

## Integration Points
- ShowRunner: Receives events
- ScenePreparationManager: Handles scene preparation
- SpeakPayloadManager: Manages dialogue
- Effect Systems: Applies visual effects
- Character Systems: Manages character state

## Performance Considerations
- Effects are applied per character
- Some effects may be resource-intensive
- Consider effect duration and frequency
- Monitor performance impact of multiple effects 