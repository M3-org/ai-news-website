# ShowRunner Documentation

## Overview
The `ShowRunner` class is the central orchestrator for the entire AIShow experience within Unity. It acts as the main controller, managing the flow of the show, loading data, handling user interactions indirectly via the UI, and coordinating other subsystems.

## Core Responsibilities
Based on the project overview, the `ShowRunner` is responsible for:

-   **Show Data Management:** Loading show configurations and episode data from JSON sources.
-   **Episode Lifecycle:** Managing the selection, loading, and progression through episodes.
-   **Scene Management:** Coordinating scene loading, preparation, and transitions, often delegating tasks to specialized managers like `ScenePreparationManager`.
-   **Dialogue and Event Handling:** Processing `speak` events to trigger dialogue display and potentially character actions. It also handles other events like `episodeGenerated` and `prepareScene`.
-   **State Management:** Tracking the current state of the show (e.g., Loading, Playing, Paused, Commercial Break).
-   **UI Interaction Gateway:** Receiving commands triggered by UI interactions (e.g., selecting an episode, play/pause, next step).
-   **Subsystem Coordination:** Interacting with other key components like `CommercialManager`, `BackgroundMusicManager`, `EventProcessor`, and potentially `YouTubeTranscriptGenerator` upon episode completion.

## Key Methods (Inferred/Mentioned)
*(This section will be expanded based on actual code review)*

-   `LoadShowData()`: Initiates the loading of the show structure.
-   `SelectEpisode(int index)`: Handles the logic when a user selects an episode from the UI.
-   `PrepareScene(string sceneName)`: Manages the process of getting a scene ready to play.
-   `SendSpeakEvent(string actor, string line, string action)`: Processes dialogue events.
-   Methods for handling Play/Pause/Next state changes.
-   Methods for interacting with `CommercialManager` to pause/resume show state during ad breaks.

## Dependencies
*(This section will be expanded based on actual code review)*

-   `ShowData`: Relies on the data structures defined in `ShowData.cs`.
-   `ShowRunnerUI` / `ShowRunnerUIContainer`: Interacts with the UI system to display information and receive input.
-   `EventProcessor`: Sends events for processing.
-   `ScenePreparationManager`: Delegates scene loading tasks.
-   `CommercialManager`: Coordinates commercial breaks.
-   `BackgroundMusicManager`: Manages background audio playback relative to show state.
-   `EventManager` (or similar): Likely used for broadcasting key events (e.g., `OnEpisodeComplete`).

## Workflow Integration
The `ShowRunner` sits at the heart of the application's data and control flow:

1.  **Initialization:** Loads `ShowData`.
2.  **Episode Selection:** User selects an episode via UI -> `ShowRunnerUI` informs `ShowRunner`.
3.  **Scene Preparation:** `ShowRunner` initiates scene prep (potentially via `EventProcessor` -> `ScenePreparationManager`).
4.  **Playback:** `ShowRunner` steps through dialogue (`speak` events), potentially triggering character actions and media display.
5.  **Commercial Breaks:** Before loading a new scene, checks with `CommercialManager` if a break is needed. Pauses its own state (not `Time.timeScale`) while commercials play, then resumes.
6.  **Completion:** Triggers final events (like for `YouTubeTranscriptGenerator`) when an episode ends.

## Configuration
*(Details on relevant Inspector fields or configuration dependencies will be added here after code review)*

---
*Generated documentation - Requires review against actual `ShowRunner.cs` implementation.* 