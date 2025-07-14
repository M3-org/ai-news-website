# Mobile Resolution Output Refactor Plan

## Overview

This refactor adds mobile resolution support (9:16 portrait) to the existing 16:9 desktop recording system. The solution addresses the cascade of issues: enum-based resolution selection, runtime recording output changes, render texture swapping, UI scaling, and camera assignment conflicts.

## Current System Analysis

**Current Issues:**
- Hardcoded 1920x1080 resolution in multiple components
- Render textures are fixed at desktop resolution
- Camera system uses actor names as keys, preventing duplicates
- UI elements scale incorrectly when resolution changes
- No runtime resolution switching capability

## Solution Architecture

### 1. Core Resolution Configuration

```csharp
// Assets/Scripts/Configuration/OutputResolution.cs
using UnityEngine;

namespace ShowRunner.Configuration
{
    [System.Serializable]
    public enum OutputResolution
    {
        Desktop_1920x1080,
        Mobile_1080x1920,  // 9:16 portrait
        Mobile_1080x1350,  // 4:5 Instagram-friendly
        Custom
    }

    [System.Serializable]
    public struct ResolutionSettings
    {
        public int width;
        public int height;
        public string suffix; // For asset naming: "_desktop", "_mobile", etc.
        public float aspectRatio;
        
        public static ResolutionSettings GetSettings(OutputResolution resolution)
        {
            return resolution switch
            {
                OutputResolution.Desktop_1920x1080 => new ResolutionSettings 
                { 
                    width = 1920, 
                    height = 1080, 
                    suffix = "_desktop",
                    aspectRatio = 16f/9f
                },
                OutputResolution.Mobile_1080x1920 => new ResolutionSettings 
                { 
                    width = 1080, 
                    height = 1920, 
                    suffix = "_mobile",
                    aspectRatio = 9f/16f
                },
                OutputResolution.Mobile_1080x1350 => new ResolutionSettings 
                { 
                    width = 1080, 
                    height = 1350, 
                    suffix = "_mobile_square",
                    aspectRatio = 4f/5f
                },
                _ => new ResolutionSettings 
                { 
                    width = 1920, 
                    height = 1080, 
                    suffix = "_desktop",
                    aspectRatio = 16f/9f
                }
            };
        }
    }
}
```

### 2. Main Resolution Manager

```csharp
// Assets/Scripts/Configuration/ResolutionManager.cs
using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;
using ShowRunner.Utility;

namespace ShowRunner.Configuration
{
    /// <summary>
    /// Manages resolution switching for recording, UI, and render textures.
    /// Handles the cascade of changes needed when switching between desktop and mobile output.
    /// </summary>
    public class ResolutionManager : MonoBehaviour
    {
        public static ResolutionManager Instance { get; private set; }
        
        [Header("Resolution Settings")]
        [SerializeField] private OutputResolution currentResolution = OutputResolution.Desktop_1920x1080;
        [SerializeField] private OutputResolution defaultResolution = OutputResolution.Desktop_1920x1080;
        
        [Header("Render Texture Sets")]
        [SerializeField] private RenderTextureSet[] renderTextureSets;
        
        [Header("Camera Sets")]
        [SerializeField] private CameraSet[] cameraSets;
        
        [Header("UI Canvas Scaling")]
        [SerializeField] private CanvasScaler[] canvasScalers;
        
        [Header("Debug")]
        [SerializeField] private bool logResolutionChanges = true;
        
        // Events for other systems to respond to resolution changes
        public static event System.Action<OutputResolution> OnResolutionChanged;
        
        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            
            // Initialize with default resolution
            ApplyResolution(defaultResolution, false);
        }
        
        private void Start()
        {
            // Ensure initial state is correct
            ValidateCurrentSetup();
        }
        
        /// <summary>
        /// Switch to a new resolution. Can be called at runtime before recording starts.
        /// </summary>
        public void SwitchResolution(OutputResolution newResolution)
        {
            if (currentResolution == newResolution) 
            {
                if (logResolutionChanges)
                    Debug.Log($"ResolutionManager: Already using {newResolution}, no change needed");
                return;
            }
            
            ApplyResolution(newResolution, true);
        }
        
        private void ApplyResolution(OutputResolution newResolution, bool logChange)
        {
            var oldSettings = ResolutionSettings.GetSettings(currentResolution);
            var newSettings = ResolutionSettings.GetSettings(newResolution);
            
            if (logChange && logResolutionChanges)
            {
                Debug.Log($"ResolutionManager: Switching from {currentResolution} ({oldSettings.width}x{oldSettings.height}) to {newResolution} ({newSettings.width}x{newSettings.height})");
            }
            
            // Apply changes in order
            UpdateRenderTextures(oldSettings.suffix, newSettings.suffix);
            UpdateCameraAssignments(oldSettings.suffix, newSettings.suffix);
            UpdateRecordingSettings(newSettings);
            UpdateUIScaling(newSettings);
            
            currentResolution = newResolution;
            
            // Notify other systems
            OnResolutionChanged?.Invoke(newResolution);
            
            if (logChange && logResolutionChanges)
            {
                Debug.Log($"ResolutionManager: Successfully switched to {newResolution}");
            }
        }
        
        private void UpdateRenderTextures(string oldSuffix, string newSuffix)
        {
            int swappedCount = 0;
            
            foreach (var set in renderTextureSets)
            {
                if (set == null) continue;
                
                var newTexture = set.GetTextureForSuffix(newSuffix);
                
                if (newTexture != null)
                {
                    set.SwapActiveTexture(newTexture);
                    swappedCount++;
                }
                else
                {
                    Debug.LogWarning($"ResolutionManager: No texture found for suffix '{newSuffix}' in set '{set.name}'");
                }
            }
            
            if (logResolutionChanges)
                Debug.Log($"ResolutionManager: Updated {swappedCount} render texture sets");
        }
        
        private void UpdateCameraAssignments(string oldSuffix, string newSuffix)
        {
            var cameraStateMachine = CameraStateMachine.Instance;
            if (cameraStateMachine == null)
            {
                Debug.LogWarning("ResolutionManager: CameraStateMachine not found, skipping camera updates");
                return;
            }
            
            int deactivatedCount = 0;
            int activatedCount = 0;
            
            foreach (var set in cameraSets)
            {
                if (set == null) continue;
                
                var oldCameras = set.GetCamerasForSuffix(oldSuffix);
                var newCameras = set.GetCamerasForSuffix(newSuffix);
                
                // Deactivate old cameras
                foreach (var cam in oldCameras)
                {
                    if (cam.camera != null)
                    {
                        cam.camera.gameObject.SetActive(false);
                        deactivatedCount++;
                    }
                }
                
                // Prepare new cameras (don't activate yet - let state machine handle it)
                foreach (var cam in newCameras)
                {
                    if (cam.camera != null)
                    {
                        // Ensure camera is ready but not active
                        cam.camera.gameObject.SetActive(false);
                        activatedCount++;
                    }
                }
            }
            
            // Force camera system to re-register everything
            cameraStateMachine.RegisterAllActorCameras();
            
            if (logResolutionChanges)
                Debug.Log($"ResolutionManager: Deactivated {deactivatedCount} old cameras, prepared {activatedCount} new cameras");
        }
        
        private void UpdateRecordingSettings(ResolutionSettings settings)
        {
            var recorder = ShowRecorder.Instance;
            if (recorder != null)
            {
                recorder.outputWidth = settings.width;
                recorder.outputHeight = settings.height;
                
                if (logResolutionChanges)
                    Debug.Log($"ResolutionManager: Updated recording resolution to {settings.width}x{settings.height}");
            }
            else
            {
                Debug.LogWarning("ResolutionManager: ShowRecorder not found, recording settings not updated");
            }
        }
        
        private void UpdateUIScaling(ResolutionSettings settings)
        {
            foreach (var scaler in canvasScalers)
            {
                if (scaler == null) continue;
                
                // Adjust UI scaling based on aspect ratio
                if (settings.aspectRatio < 1f) // Portrait mode
                {
                    scaler.matchWidthOrHeight = 0f; // Match width for portrait
                }
                else // Landscape mode
                {
                    scaler.matchWidthOrHeight = 1f; // Match height for landscape
                }
            }
            
            if (logResolutionChanges && canvasScalers.Length > 0)
                Debug.Log($"ResolutionManager: Updated {canvasScalers.Length} canvas scalers for aspect ratio {settings.aspectRatio:F2}");
        }
        
        private void ValidateCurrentSetup()
        {
            // Check for missing components
            if (renderTextureSets.Length == 0)
                Debug.LogWarning("ResolutionManager: No render texture sets configured");
            
            if (cameraSets.Length == 0)
                Debug.LogWarning("ResolutionManager: No camera sets configured");
            
            // Validate each render texture set
            foreach (var set in renderTextureSets)
            {
                if (set != null)
                    set.ValidateSetup();
            }
        }
        
        /// <summary>
        /// Get current resolution settings
        /// </summary>
        public ResolutionSettings GetCurrentSettings()
        {
            return ResolutionSettings.GetSettings(currentResolution);
        }
        
        /// <summary>
        /// Check if a specific resolution is currently active
        /// </summary>
        public bool IsResolutionActive(OutputResolution resolution)
        {
            return currentResolution == resolution;
        }
        
        /// <summary>
        /// Get available resolutions
        /// </summary>
        public OutputResolution[] GetAvailableResolutions()
        {
            return new OutputResolution[]
            {
                OutputResolution.Desktop_1920x1080,
                OutputResolution.Mobile_1080x1920,
                OutputResolution.Mobile_1080x1350
            };
        }
    }
    
    /// <summary>
    /// Represents a set of render textures for different resolutions
    /// </summary>
    [System.Serializable]
    public class RenderTextureSet
    {
        [Header("Identification")]
        public string name;
        
        [Header("Render Textures")]
        public RenderTexture desktopTexture;
        public RenderTexture mobileTexture;
        public RenderTexture mobileSquareTexture;
        
        [Header("UI Target")]
        public RawImage targetUI; // UI element that displays this texture
        
        [Header("Additional Targets")]
        public Material[] materialsToUpdate; // Materials that use this texture
        
        public RenderTexture GetTextureForSuffix(string suffix)
        {
            return suffix switch
            {
                "_desktop" => desktopTexture,
                "_mobile" => mobileTexture,
                "_mobile_square" => mobileSquareTexture,
                _ => desktopTexture
            };
        }
        
        public void SwapActiveTexture(RenderTexture newTexture)
        {
            if (targetUI != null)
            {
                targetUI.texture = newTexture;
            }
            
            // Update materials if any
            foreach (var material in materialsToUpdate)
            {
                if (material != null)
                {
                    material.mainTexture = newTexture;
                }
            }
        }
        
        public void ValidateSetup()
        {
            if (string.IsNullOrEmpty(name))
                Debug.LogWarning($"RenderTextureSet: Name is empty");
                
            if (desktopTexture == null)
                Debug.LogWarning($"RenderTextureSet '{name}': Desktop texture is null");
                
            if (mobileTexture == null)
                Debug.LogWarning($"RenderTextureSet '{name}': Mobile texture is null");
                
            if (targetUI == null && (materialsToUpdate == null || materialsToUpdate.Length == 0))
                Debug.LogWarning($"RenderTextureSet '{name}': No UI target or materials assigned");
        }
    }
    
    /// <summary>
    /// Represents a set of cameras for different resolutions
    /// </summary>
    [System.Serializable]
    public class CameraSet
    {
        [Header("Actor")]
        public string actorName;
        
        [Header("Camera Assignments")]
        public CameraAssignment[] desktopCameras;
        public CameraAssignment[] mobileCameras;
        
        public CameraAssignment[] GetCamerasForSuffix(string suffix)
        {
            return suffix switch
            {
                "_desktop" => desktopCameras,
                "_mobile" => mobileCameras,
                _ => desktopCameras
            };
        }
    }
    
    /// <summary>
    /// Links a camera to an actor name
    /// </summary>
    [System.Serializable]
    public class CameraAssignment
    {
        public string actorName;
        public Camera camera;
        
        [Header("Optional")]
        public string description; // For inspector organization
    }
}
```

### 3. CLI Integration

```csharp
// Add to Assets/Scripts/CLI/EpisodeProcessorCLI.cs
// Insert this method in the EpisodeProcessorCLI class

/// <summary>
/// Configure resolution before recording starts
/// </summary>
private static void ConfigureResolution(CLIArguments args)
{
    var resolutionManager = UnityEngine.Object.FindObjectOfType<ResolutionManager>();
    if (resolutionManager == null)
    {
        Debug.LogWarning("[CLI] ResolutionManager not found in scene. Using default resolution settings.");
        return;
    }
    
    // Parse resolution from CLI args
    OutputResolution targetResolution = OutputResolution.Desktop_1920x1080;
    
    if (!string.IsNullOrEmpty(args.resolution))
    {
        if (System.Enum.TryParse<OutputResolution>(args.resolution, true, out var parsedResolution))
        {
            targetResolution = parsedResolution;
        }
        else
        {
            Debug.LogWarning($"[CLI] Invalid resolution '{args.resolution}'. Using default.");
        }
    }
    else if (args.width != 1920 || args.height != 1080)
    {
        // Detect mobile resolution from width/height
        if (args.width == 1080 && args.height == 1920)
        {
            targetResolution = OutputResolution.Mobile_1080x1920;
        }
        else if (args.width == 1080 && args.height == 1350)
        {
            targetResolution = OutputResolution.Mobile_1080x1350;
        }
    }
    
    Debug.Log($"[CLI] Setting resolution to {targetResolution}");
    resolutionManager.SwitchResolution(targetResolution);
}

// Add to CLIArguments class
public string resolution = ""; // -resolution Mobile_1080x1920

// Add to ParseCommandLineArguments method
case "-resolution":
    if (i + 1 < args.Length)
        cliArgs.resolution = args[i + 1];
    break;

// Call ConfigureResolution in ProcessEpisode method before StartEpisodeRecording
ConfigureResolution(args);
StartEpisodeRecording(args);
```

### 4. Enhanced ShowRecorder Integration

```csharp
// Add to Assets/Scripts/Utilities/ShowRecorder.cs
// Insert these methods in the ShowRecorder class

/// <summary>
/// Update resolution settings at runtime (before recording starts)
/// </summary>
public void UpdateResolution(int width, int height)
{
    if (m_IsRecording)
    {
        Debug.LogWarning("ShowRecorder: Cannot change resolution while recording is active");
        return;
    }
    
    outputWidth = width;
    outputHeight = height;
    
    Debug.Log($"ShowRecorder: Resolution updated to {width}x{height}");
}

/// <summary>
/// Update resolution from ResolutionManager
/// </summary>
public void UpdateResolution(ResolutionSettings settings)
{
    UpdateResolution(settings.width, settings.height);
}

// Add to Awake method
private void Awake()
{
    // ... existing code ...
    
    // Subscribe to resolution changes
    ResolutionManager.OnResolutionChanged += OnResolutionChanged;
}

private void OnDestroy()
{
    // Unsubscribe from resolution changes
    if (ResolutionManager.OnResolutionChanged != null)
        ResolutionManager.OnResolutionChanged -= OnResolutionChanged;
}

private void OnResolutionChanged(OutputResolution newResolution)
{
    var settings = ResolutionSettings.GetSettings(newResolution);
    UpdateResolution(settings);
}
```

### 5. Commercial Manager Resolution Support

```csharp
// Add to Assets/Scripts/ShowRunner/CommercialManager.cs
// Replace the hardcoded RenderTexture creation in Awake method

private void Awake()
{
    // ... existing code until RenderTexture creation ...
    
    // Configure Video Player
    if (videoPlayer != null)
    {
        videoPlayer.playOnAwake = false;
        
        // Create render texture based on current resolution
        if (videoPlayer.targetTexture == null)
        {
            CreateRenderTextureForCurrentResolution();
        }
        
        // ... rest of existing code ...
    }
}

private void CreateRenderTextureForCurrentResolution()
{
    var resolutionManager = ResolutionManager.Instance;
    ResolutionSettings settings;
    
    if (resolutionManager != null)
    {
        settings = resolutionManager.GetCurrentSettings();
    }
    else
    {
        // Fallback to default
        settings = ResolutionSettings.GetSettings(OutputResolution.Desktop_1920x1080);
        Debug.LogWarning("CommercialManager: ResolutionManager not found, using default resolution");
    }
    
    Debug.Log($"CommercialManager: Creating RenderTexture ({settings.width}x{settings.height})");
    videoPlayer.targetTexture = new RenderTexture(settings.width, settings.height, 24);
    
    // Assign the texture to the display image
    if (videoDisplay != null)
    {
        videoDisplay.texture = videoPlayer.targetTexture;
    }
}

// Add resolution change handler
private void OnEnable()
{
    // Subscribe to resolution changes
    ResolutionManager.OnResolutionChanged += OnResolutionChanged;
}

private void OnDisable()
{
    // Unsubscribe from resolution changes
    if (ResolutionManager.OnResolutionChanged != null)
        ResolutionManager.OnResolutionChanged -= OnResolutionChanged;
}

private void OnResolutionChanged(OutputResolution newResolution)
{
    if (videoPlayer != null && videoPlayer.targetTexture != null)
    {
        // Destroy old render texture
        var oldTexture = videoPlayer.targetTexture;
        
        // Create new render texture
        CreateRenderTextureForCurrentResolution();
        
        // Clean up old texture
        if (oldTexture != null)
        {
            oldTexture.Release();
            DestroyImmediate(oldTexture);
        }
        
        Debug.Log($"CommercialManager: Updated render texture for resolution {newResolution}");
    }
}
```

## Implementation Steps

### Phase 1: Core Setup
1. Create the `OutputResolution.cs` and `ResolutionManager.cs` scripts
2. Add ResolutionManager to your main scene
3. Create mobile versions of critical render textures with `_mobile` suffix

### Phase 2: Asset Creation
1. Duplicate existing render textures in `Assets/Textures/RenderTextures/`
2. Rename copies with `_mobile` suffix (e.g., `MainTV_mobile.renderTexture`)
3. Update mobile render textures to 1080x1920 resolution
4. Create mobile camera positions/angles for key shots

### Phase 3: Scene Configuration
1. Configure ResolutionManager component in scene:
   - Assign render texture sets (desktop + mobile pairs)
   - Assign camera sets (desktop + mobile camera assignments)
   - Link UI canvas scalers
2. Test resolution switching in editor

### Phase 4: CLI Integration
1. Update CLI argument parsing to accept `-resolution` parameter
2. Add resolution configuration to recording pipeline
3. Test CLI with mobile resolution parameters

### Phase 5: System Integration
1. Update ShowRecorder for resolution change events
2. Update CommercialManager for dynamic render texture creation
3. Test full recording pipeline with both resolutions

## Usage Examples

### CLI Usage
```bash
# Desktop recording (default)
Unity.exe -batchmode -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.ProcessEpisodeFromCommandLine -episodePath "episode.json"

# Mobile portrait recording
Unity.exe -batchmode -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.ProcessEpisodeFromCommandLine -episodePath "episode.json" -resolution Mobile_1080x1920

# Mobile square recording
Unity.exe -batchmode -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.ProcessEpisodeFromCommandLine -episodePath "episode.json" -resolution Mobile_1080x1350

# Legacy width/height (auto-detected)
Unity.exe -batchmode -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.ProcessEpisodeFromCommandLine -episodePath "episode.json" -width 1080 -height 1920
```

### Runtime Usage
```csharp
// Switch to mobile resolution before recording
var resolutionManager = ResolutionManager.Instance;
resolutionManager.SwitchResolution(OutputResolution.Mobile_1080x1920);

// Start recording - will use mobile resolution
ShowRecorder.Instance.InitializeAndStartRecording();
```

## Benefits

- **Clean Architecture**: Centralized resolution management
- **No Duplicates**: Camera swapping prevents registration conflicts  
- **Runtime Flexibility**: Change resolution before recording starts
- **Backward Compatible**: Existing desktop setup continues to work
- **Extensible**: Easy to add new resolutions and aspect ratios
- **Asset Organization**: Clear naming conventions with suffixes
- **Event-Driven**: Other systems can respond to resolution changes

This solution addresses all the cascade issues you mentioned while maintaining clean, maintainable code that follows Unity best practices. 