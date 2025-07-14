# ShowRunnerUIContainer Component

## Overview
The ShowRunnerUIContainer manages the UI elements and their interactions for the ShowRunner system. It provides a centralized container for all UI components and handles their visibility, interactability, and state management.

## UI Components

### Canvas
```csharp
[Header("UI Canvas")]
[SerializeField] private Canvas mainCanvas;
```
- Main canvas for UI rendering
- Controls overall UI visibility

### UI Elements
```csharp
[Header("UI Elements")]
[SerializeField] private TMP_Dropdown showFileDropdown;
[SerializeField] private TMP_Dropdown episodeDropdown;
[SerializeField] private Button loadButton;
[SerializeField] private Button nextButton;
[SerializeField] private Button playButton;
[SerializeField] private Button pauseButton;
[SerializeField] private TextMeshProUGUI statusText;
```
- Show file selection dropdown
- Episode selection dropdown
- Control buttons
- Status text display

### References
```csharp
[Header("References")]
[SerializeField] private ShowRunner showRunner;
[SerializeField] private ShowRunnerUI uiController;
```
- ShowRunner instance
- UI controller reference

### Settings
```csharp
[Header("Settings")]
[SerializeField] private KeyCode toggleKey = KeyCode.BackQuote;
[SerializeField] private bool uiVisibleOnStart = true;
```
- UI toggle key
- Initial visibility state

## Core Functionality

### Initialization
```csharp
private void Awake()
private void Start()
```
- Component validation
- Reference resolution
- UI state initialization
- Status text setup

### UI Visibility
```csharp
public void SetUIVisible(bool visible)
public void SetUIInteractable(bool interactable)
```
- Toggle UI visibility
- Control interactability
- Handle keyboard shortcuts
- Manage canvas state

### Dropdown Management
```csharp
public void PopulateShowFileDropdown(List<string> showFileNames)
public void PopulateEpisodeDropdown(List<string> episodeTitles)
```
- Populate dropdowns
- Handle selections
- Update UI state
- Manage interactability

### Control Management
```csharp
public void SetEpisodeSelectionInteractable(bool interactable)
public void SetPlaybackControlsInteractable(bool interactable)
public void SetAutoPlayControls(bool isAutoPlaying)
```
- Control button states
- Auto-play management
- Selection interactability
- Playback control states

### Status Updates
```csharp
public void UpdateStatusText(string message)
private void EnsureStatusTextComponent()
```
- Status display
- Component validation
- Error handling
- User feedback

## Component Access

### Getters
```csharp
public TMP_Dropdown GetShowFileDropdown()
public TMP_Dropdown GetEpisodeDropdown()
public Button GetLoadButton()
public Button GetNextButton()
public Button GetPlayButton()
public Button GetPauseButton()
public TextMeshProUGUI GetStatusText()
```
- Access to UI components
- Component validation
- Reference management
- Error handling

## Best Practices
1. Validate all UI components
2. Handle missing references
3. Manage UI state consistently
4. Provide clear user feedback
5. Use appropriate component access

## Error Handling
- Component validation
- Reference resolution
- State management
- User feedback
- Error logging

## Integration Points
- ShowRunner: For show control
- ShowRunnerUI: For UI logic
- Event System: For user input
- Canvas System: For rendering
- Input System: For shortcuts

## Performance Considerations
- UI update frequency
- Component access
- State management
- Event handling
- Resource usage

## Setup Requirements
1. Canvas setup
2. UI component assignment
3. Reference configuration
4. Event system setup
5. Input system configuration

## Debugging
- Component validation
- State tracking
- Event handling
- UI updates
- Reference management

## Event Handling
- UI visibility toggle
- Dropdown selection
- Button interaction
- Status updates
- Auto-play control 