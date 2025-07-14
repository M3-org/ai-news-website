# ShowRunnerUI Component

**File:** `Assets/Scripts/ShowRunner/ShowRunnerUI.cs`

## Overview
The ShowRunnerUI manages the user interface for the ShowRunner system, handling UI interactions, state updates, and user input processing. It provides controls for show playback, episode selection, and status display.

## Dependencies
- `ShowRunner` (`Assets/Scripts/ShowRunner/ShowRunner.cs`): Main system controller
- `ShowRunnerUIContainer` (`Assets/Scripts/ShowRunner/ShowRunnerUIContainer.cs`): UI element container
- TextMeshPro: For text display
- UnityEngine.UI: For UI components

## Core Components

### References
```csharp
[Header("Components")]
[SerializeField] private ShowRunner showRunner;
[SerializeField] private ShowRunnerUIContainer uiContainer;
```
- ShowRunner instance
- UI container reference

### State Management
```csharp
private bool autoPlay = false;
private bool isPlaying = false;
private float autoPlayTimer = 0f;
```
- Auto-play state
- Playback state
- Timer for auto-advance

## Core Functionality

### Initialization
```csharp
private void Start()
```
- Sets up event listeners
- Initializes UI components
- Configures show file selection
- Updates status display

### Show File Management
```csharp
private void InitializeShowFileSelection()
private void OnShowFileSelected(int index)
```
- Populates show file dropdown
- Handles file selection
- Updates episode list
- Manages UI state

### Episode Management
```csharp
private void InitializeEpisodeDropdown()
public void LoadSelectedEpisode()
```
- Populates episode dropdown
- Handles episode loading
- Updates UI state
- Manages playback controls

### Playback Control
```csharp
public void NextStep()
public void StartAutoPlay()
public void StopAutoPlay()
```
- Manual advancement
- Auto-play control
- Playback state management
- Timer handling

### UI Updates
```csharp
private void UpdateStatusText(string message)
public void RefreshShowData()
```
- Status display
- Data refresh
- UI state updates
- Error handling

## UI Elements

### Dropdowns
- Show file selection
- Episode selection
- Dynamic population
- Selection handling

### Buttons
- Load button
- Next button
- Play button
- Pause button

### Status Display
- Loading status
- Error messages
- Playback state
- Selection feedback

## Best Practices
1. Validate component references
2. Handle missing dependencies
3. Update UI state consistently
4. Provide clear user feedback
5. Manage playback states properly

## Error Handling
- Validates component references
- Handles missing dependencies
- Manages UI state errors
- Provides user feedback
- Logs important events

## Integration Points
- ShowRunner: For show control
- UIContainer: For UI elements
- Event System: For user input
- Status System: For feedback
- Playback System: For control

## Performance Considerations
- UI update frequency
- Event listener management
- State change handling
- Auto-play timing
- Resource management

## Setup Requirements
1. ShowRunner instance
2. UIContainer reference
3. UI element setup
4. Event listener configuration
5. Status display setup

## Debugging
- Component validation
- State tracking
- Event handling
- UI updates
- Playback control

## Event Handling
- Show file selection
- Episode selection
- Playback control
- Auto-play management
- Status updates 