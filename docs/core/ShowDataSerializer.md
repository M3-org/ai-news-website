# ShowDataSerializer Utility

## Overview
`ShowDataSerializer` is a static utility class for serializing and deserializing show data to and from JSON files. It provides methods for loading, saving, and creating new show data objects in the ShowRunner system.

## Core Responsibilities
- Load show data from a JSON file.
- Save show data to a JSON file.
- Create a new show data object with default configuration and prompts.

## Main Methods
- `ShowData LoadFromFile(string filePath)`: Loads and deserializes show data from a JSON file. Returns a `ShowData` object or null on error.
- `bool SaveToFile(ShowData showData, string filePath)`: Serializes and saves show data to a JSON file. Returns true on success, false on error.
- `ShowData CreateNewShow()`: Returns a new `ShowData` object with default configuration, prompts, actors, and locations.

## Usage
- Use `LoadFromFile` to import show data from disk.
- Use `SaveToFile` to export or update show data on disk.
- Use `CreateNewShow` to generate a template show data object for new projects.

## Error Handling
- All file operations are wrapped in try/catch blocks.
- Errors are logged to the Unity console.
- Returns null or false on failure.

## Integration Points
- ShowRunner: For loading and saving show data.
- Editor tools: For creating new show templates.
- JSON files: For persistent storage.

## Example
```csharp
// Load show data
ShowData data = ShowDataSerializer.LoadFromFile("path/to/show.json");

// Save show data
ShowDataSerializer.SaveToFile(data, "path/to/show.json");

// Create a new show template
ShowData newShow = ShowDataSerializer.CreateNewShow();
``` 