# AI Show - Unity 3D Show Production System

An AI-powered 3D show production system that transforms scattered information from Discord, GitHub, and Twitter into engaging video content featuring VRM avatars. Built for automated news shows, community updates, and interactive storytelling.

![AI Show Screenshot](https://github.com/user-attachments/assets/342849c1-fbeb-4d72-b4bf-d2a7c537033b)

## 🚀 Quick Start

### Prerequisites
- **Unity 2022.3.53f1** - [Download](https://unity.com/download)
- **Git** - For cloning the repository
- **Python 3.8+** - For video processing scripts

### 5-Minute Setup
1. **Clone the repository**
   ```bash
   git clone https://github.com/elizaOS/aishow.git
   cd aishow
   ```

2. **Open in Unity**
   - Open Unity Hub
   - Click "Add" and select the project folder
   - Open with Unity 2022.3.53f1

3. **Install Dependencies**
   - Unity will automatically import required packages
   - Key packages: UniVRM, Newtonsoft JSON, Animation Rigging, Timeline, Unity Recorder

4. **Test the System**
   - Open the main scene: `Assets/Scenes/podcast_desk.unity`
   - Press Play to start the ShowRunner system
   - Load a sample episode from the dropdown

### First Episode
Sample episodes are located in `Assets/Resources/Episodes/`. The system will automatically discover and list available shows in the UI dropdown.

## 📖 Project Overview

### What It Does
- **Automated Content Creation**: Generates news shows from GitHub updates, Discord conversations, and social media
- **3D Avatar Shows**: Features VRM avatars with facial expressions, lip sync, and character animations  
- **Scene Management**: Dynamic scene transitions, commercial breaks, and background music
- **Multi-format Output**: Video recording, transcript generation, and cross-platform publishing

### Key Features
- **VRM Avatar Support**: Full 3D character animation with Oculus Lip Sync
- **Effects System**: Glitch effects, particle systems, visual enhancements
- **Event-Driven Architecture**: Modular system for easy extension
- **Multi-language Support**: Translation pipeline for international content
- **Automated Publishing**: YouTube upload and social media posting

## 🏗️ Architecture Overview

### Core Components
```
ShowRunner (Central Controller)
├── EventProcessor (Handles dialogue, scenes, MIDI)
├── ScenePreparationManager (Async scene loading)
├── ShowRunnerUI (User interface)
└── Effects System (Visual effects)
```

### Data Flow
```
JSON Episodes → ShowRunner → EventProcessor → [Scene/Dialogue/Effects] → Video Output
```

### Key Integration Points
- **ShowRunner Singleton**: `ShowRunner.Instance` - Access from any component
- **Event Processing**: `EventProcessor.ProcessEvent(EventData)` - Handle all event types
- **Effect Triggering**: Action strings (`"excited"`, `"happy"`, `"spazz"`, `"bighead_grow"`)
- **Scene Management**: Async preparation via ScenePreparationManager

## 🛠️ Development Guide

### Adding New Features

#### 1. New Effect Component
```csharp
// Create in Assets/Scripts/Effects/
public class MyEffect : MonoBehaviour {
    public void TriggerEffect() {
        // Your effect logic
    }
}

// Add to EventProcessor.HandleSpeak():
case "myaction":
    myEffectComponent.TriggerEffect();
    break;
```

#### 2. New Event Type
```csharp
// In EventProcessor.ProcessEvent():
case "myevent":
    HandleMyEvent(eventData);
    break;
```

#### 3. New UI Component
- Reference ShowRunner for data access: `ShowRunner.Instance`
- Subscribe to relevant events: `ShowRunner.OnEpisodeSelectedForDisplay`
- Follow existing UI update patterns

### Common Patterns
- **Component Validation**: All components validate dependencies in `Awake()`
- **Graceful Degradation**: Effects handle missing components gracefully
- **Event-Driven**: Use static events for loose coupling between systems
- **Inspector Configuration**: Expose settings via `[SerializeField]` fields

### Project Structure
```
Assets/
├── Scripts/
│   ├── ShowRunner/          # Core system
│   ├── Effects/             # Visual effects
│   ├── APIs/               # External integrations
│   ├── UI/                 # User interface
│   └── Utilities/          # Helper components
├── Resources/Episodes/      # JSON episode data
├── VRMs/                   # Avatar models
└── Scenes/                 # Unity scenes
```

## 📚 Documentation Reference

### For Implementation Details
- **[Component Relationships](docs/COMPONENT_RELATIONSHIPS.md)** - System architecture and dependencies
- **[ShowRunner API](docs/core/ShowRunner.md)** - Complete public API (15+ methods, events)
- **[EventProcessor API](docs/core/EventProcessor.md)** - Event handling and actor actions
- **[CLAUDE.md](CLAUDE.md)** - Comprehensive development guide for LLM agents

### For Specific Components
- **[Animation System](docs/animation/)** - RotateSphere, WaypointManager
- **[Effects System](docs/effects/)** - GlitchOutEffect, BigHeadEffect, etc.
- **[UI Components](docs/ui/)** - ShowRunnerUI, container setup

## 🎬 Usage Examples

### Loading and Playing Episodes
```csharp
// Access the singleton
var showRunner = ShowRunner.Instance;

// Load a show
showRunner.LoadShowData("my-show");

// Select an episode
showRunner.SelectEpisode(0);

// Control playback
showRunner.SetManualMode(false); // Enable auto-play
showRunner.NextStep(); // Manual step
```

### Triggering Effects
```csharp
var eventData = new EventData {
    type = "speak",
    actor = "Character1",
    line = "This is exciting!",
    action = "excited" // Triggers ExcitedEffect
};

eventProcessor.ProcessEvent(eventData);
```

### Episode JSON Structure
```json
{
  "config": {
    "name": "My Show",
    "actors": {
      "host": {
        "name": "Show Host",
        "voice": "elevenlabs_voice_id"
      }
    }
  },
  "episodes": [{
    "id": "ep1",
    "name": "Episode 1",
    "scenes": [{
      "location": "studio",
      "dialogue": [{
        "actor": "host",
        "line": "Welcome to the show!",
        "action": "wave"
      }]
    }]
  }]
}
```

## 🔧 Development Scripts

### Video Processing
```bash
# Fix video color space issues
python fix_videos.py

# Batch video conversion (PowerShell)
./Convert-Videos.ps1 -InputDirectory "input" -OutputDirectory "output"
```

### Unity Development
- **Main Scene**: `Assets/Scenes/podcast_desk.unity`
- **Episode Loading**: Place JSON files in `Assets/Resources/Episodes/`
- **Avatar Import**: Add VRM files to `Assets/VRMs/`

## 🐛 Troubleshooting

### Common Issues

**Episode Not Loading**
- Check JSON syntax with online validator
- Ensure file is in `Assets/Resources/Episodes/`
- Verify all required fields are present

**Missing Effects**
- Check Console for component validation errors
- Ensure effect components are attached to actor GameObjects
- Verify action strings match supported actions (see EventProcessor docs)

**Audio Issues**
- Check AudioSource assignments in ShowRunner
- Verify actor names match between JSON and AudioSource mappings
- Test with manual audio file placement

**Scene Preparation Fails**
- Ensure ScenePreparationManager is attached
- Check for missing scene references
- Verify async loading completion

### Getting Help
- **Console Logs**: Check Unity Console for detailed error messages
- **Documentation**: Refer to component-specific docs in `docs/` folder
- **Wiki**: Visit our [project wiki](https://github.com/elizaOS/aishow/wiki)

## 🎯 Use Cases

### Content Creators
- **News Shows**: Automated updates from GitHub, Discord, Twitter
- **Community Updates**: DAO announcements and project showcases
- **Educational Content**: Technical explanations with visual aids

### Developers
- **Custom Shows**: Build specialized content for your community
- **Integration**: Connect to your data sources and APIs
- **Extension**: Add new effects, scenes, and interaction patterns

### Communities
- **Engagement**: Interactive content for DAO members
- **Automation**: Reduce manual content creation overhead
- **Branding**: Consistent visual identity across content

## 📈 Recent Achievements

- **Daily Production**: Producing episodes daily for almost a month
- **Enhanced Avatars**: Added emotions, IK systems, and advanced animations
- **Media Integration**: Dynamic image loading on TV screens
- **Architecture Upgrade**: Event-driven system for better performance
- **Commercial System**: Automated ad breaks and transitions

## 🛣️ Roadmap

### Current Development
- **Multi-language Support**: Translation pipeline for global reach
- **Enhanced AI**: Integration with Eliza for improved content generation
- **Community Features**: Spotlight system and user contributions

### Future Plans
- **Content Hub**: Searchable archive website
- **DAO Integration**: Community voting and governance features
- **Revenue Streams**: Monetization and reward systems

## 🤝 Contributing

### For Developers
1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Follow coding patterns**: See existing components for examples
4. **Test thoroughly**: Ensure no regressions in core functionality
5. **Submit pull request**: Include detailed description of changes

### For Content Creators
- **Episode Templates**: Create reusable episode structures
- **Asset Contributions**: VRM avatars, audio clips, visual effects
- **Feedback**: Report issues and suggest improvements

## 📄 License & Links

- **Repository**: [GitHub](https://github.com/elizaOS/aishow)
- **News Source**: [GM3 News Browser](https://gm3.github.io/news-browser/)
- **Behind the Scenes**: [YouTube Video](https://www.youtube.com/watch?v=fIGoyaEd0Hw)
- **Example Output**: [Sample Episode](https://www.youtube.com/watch?v=eLJt2i02mkI&t=2s)
- **Framework**: [Sithlords Showrunner](https://hackmd.io/@smsithlord/Hk7NOUrmke)

---

**Built with Unity 2022.3.53f1 | Powered by AI | Created for Community**