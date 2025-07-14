# AIShow System Diagrams

This folder contains visual documentation of the AIShow system architecture, workflows, and component relationships. These diagrams are designed to help explain the system's complexity and interactions.

## Diagram Categories

### 1. System Overview
- **High-Level Architecture** - 10,000 foot view of the entire system
- **Component Relationships** - How major components interact
- **Data Flow** - How information moves through the system

### 2. Core Workflows  
- **Episode Recording Pipeline** - From JSON to archived episode
- **Batch Processing** - Multi-language episode generation
- **Content Generation** - LLM → Audio → Video pipeline

### 3. Subsystem Details
- **Show Playback Engine** - ShowRunner, UI, and scene management
- **Recording & Archiving** - Video capture, metadata fixing, archiving
- **Language Processing** - Multi-language content generation

### 4. User Journeys
- **Manual Recording** - UI-driven episode recording
- **CLI Batch Processing** - Automated multi-episode generation
- **Configuration & Setup** - How to configure the system

## How to Read These Diagrams

**Color Coding:**
- 🟦 **Blue**: Core system components
- 🟩 **Green**: Input/Output data 
- 🟨 **Yellow**: Processing/transformation steps
- 🟥 **Red**: Error handling/fallback systems
- 🟪 **Purple**: External services/APIs

**Diagram Types:**
- **Flowcharts**: Process flows and decision paths
- **Component Diagrams**: System structure and relationships  
- **Sequence Diagrams**: Time-based interactions
- **State Diagrams**: System state transitions

## Usage

These diagrams are intended for:
- **New developers** understanding the system
- **System documentation** for architecture decisions
- **Troubleshooting** complex interaction issues
- **Planning** new features and integrations

## Maintaining Diagrams

When modifying the system:
1. Update relevant diagrams to reflect changes
2. Ensure diagrams match actual implementation
3. Add new diagrams for significant new features
4. Keep language simple and focused on clarity

---
*Last Updated: 2024-12-26* 