# ShowData Data Structures

**File:** `Assets/Scripts/ShowRunner/ShowData.cs`

## Overview
The ShowData namespace contains the core data structures used to serialize and deserialize show content from JSON files. These structures define the hierarchical organization of shows, episodes, scenes, and dialogue.

## Data Structure Hierarchy

### ShowData
**Class:** `ShowData` (`ShowData.cs:8`)
Root container for all show content.
```csharp
public class ShowData
{
    public ShowConfig Config;    // Show configuration and metadata
    public List<Episode> Episodes; // List of episodes
}
```

### ShowConfig
Configuration and metadata for the show.
```csharp
public class ShowConfig
{
    public string id;           // Unique identifier
    public string name;         // Display name
    public string description;  // Show description
    public string creator;      // Show creator
    public Dictionary<string, string> prompts;  // Episode prompts
    public Dictionary<string, ActorConfig> actors;  // Actor configurations
    public Dictionary<string, LocationConfig> locations;  // Location configurations
}
```

### ActorConfig
Configuration for individual actors.
```csharp
public class ActorConfig
{
    public string name;         // Actor name
    public string gender;       // Actor gender
    public string description;  // Actor description
    public string voice;        // Voice configuration
}
```

### LocationConfig
Configuration for show locations.
```csharp
public class LocationConfig
{
    public string name;         // Location name
    public string description;  // Location description
    public Dictionary<string, string> slots;  // Available slots
}
```

### Episode
Represents a single episode in the show.
```csharp
public class Episode
{
    public string id;          // Unique identifier
    public string name;        // Display name
    public string premise;     // Episode premise
    public string summary;     // Episode summary
    public List<Scene> scenes; // List of scenes
}
```

### Scene
Represents a scene within an episode.
```csharp
public class Scene
{
    public string location;    // Scene location
    public string description; // Scene description
    public string inTime;      // Scene start time
    public string outTime;     // Scene end time
    public Dictionary<string, string> cast;  // Cast members
    public List<Dialogue> dialogue;  // Dialogue entries
}
```

### Dialogue
Represents a single dialogue entry.
```csharp
public class Dialogue
{
    public string actor;   // Speaking character
    public string line;    // Dialogue line
    public string action;  // Action/emotion
}
```

## JSON Structure Example
```json
{
  "Config": {
    "id": "show1",
    "name": "My Show",
    "description": "Show description",
    "creator": "Creator Name",
    "prompts": {
      "prompt1": "Prompt text"
    },
    "actors": {
      "actor1": {
        "name": "Actor Name",
        "gender": "male",
        "description": "Actor description",
        "voice": "voice1"
      }
    },
    "locations": {
      "location1": {
        "name": "Location Name",
        "description": "Location description",
        "slots": {
          "slot1": "Slot description"
        }
      }
    }
  },
  "Episodes": [
    {
      "id": "episode1",
      "name": "Episode 1",
      "premise": "Episode premise",
      "summary": "Episode summary",
      "scenes": [
        {
          "location": "location1",
          "description": "Scene description",
          "inTime": "00:00",
          "outTime": "01:00",
          "cast": {
            "actor1": "role1"
          },
          "dialogue": [
            {
              "actor": "actor1",
              "line": "Dialogue line",
              "action": "action1"
            }
          ]
        }
      ]
    }
  ]
}
```

## Best Practices
1. Always provide unique IDs for episodes and actors
2. Keep dialogue lines concise and clear
3. Use consistent naming conventions for locations and slots
4. Include detailed descriptions for actors and locations
5. Validate JSON structure before loading

## Integration Points
- `ShowRunner` (`Assets/Scripts/ShowRunner/ShowRunner.cs`): Uses these structures for show playback
- `ShowDataSerializer` (`Assets/Scripts/ShowRunner/ShowDataSerializer.cs`): Handles serialization/deserialization
- `ShowValidator` (`Assets/Scripts/ShowRunner/ShowValidator.cs`): Validates data structure integrity
- `EventProcessor` (`Assets/Scripts/ShowRunner/EventProcessor.cs`): Uses dialogue data for event generation

## Error Handling
- Validate required fields are present
- Check for duplicate IDs
- Ensure proper nesting of scenes and episodes
- Verify actor and location references 