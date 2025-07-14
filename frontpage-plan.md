# AI News Website - Frontpage Plan

## Project Overview
Creating a modern, responsive React website for AI News featuring daily elizaOS updates, with a dark theme and professional broadcast aesthetic.

## Tech Stack
- **Frontend**: React 18+ with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Build Tool**: Vite (recommended for React + Tailwind)
- **Deployment**: Static hosting (Vercel, Netlify, or GitHub Pages)

## Website Structure

### 1. Hero Section
**Full-screen slideshow with overlaid branding**

#### Components:
- `HeroSlideshow.tsx` - Main slideshow component
- `SlideTransition.tsx` - Crossfade animation handler
- `HeroOverlay.tsx` - Title and tagline overlay

#### Features:
- **Background**: Darkened slideshow using JPG images from `/media/` folder
- **Images**: Cycle through `1.jpg` through `16.jpg` (existing numbered images)
- **Animation**: Crossfade transitions (3-5 second intervals)
- **Overlay**:
  - Main title: "AI News" (large, prominent)
  - Tagline: "Bringing You Daily elizaOS Updates" (subtitle style)
  - Optional: Animated typing effect or fade-in
- **Responsive**: Full viewport height on desktop, scaled appropriately on mobile

#### Technical Notes:
- Use CSS `object-fit: cover` for consistent image scaling
- Implement `opacity` transitions for smooth crossfading
- Consider using `useEffect` with `setInterval` for auto-advance
- Preload next image to prevent flicker

### 2. Episodes Section
**Grid-based episode browser with language selection**

#### Components:
- `EpisodesGrid.tsx` - Main episodes container
- `EpisodeCard.tsx` - Individual episode thumbnail + metadata
- `LanguageFilter.tsx` - EN/CH/KO toggle buttons
- `VideoLightbox.tsx` - Modal video player
- `VideoGallery.tsx` - Video index within lightbox

#### Data Structure:
```typescript
interface Episode {
  date: string; // YYYY-MM-DD format
  languages: {
    en?: EpisodeLanguage;
    ch?: EpisodeLanguage;
    ko?: EpisodeLanguage;
  };
}

interface EpisodeLanguage {
  thumbnail: string; // Path to thumbnail
  video: string; // Path to video file
  title: string; // From YouTube metadata
  description: string;
  headlines: string[]; // From headlines JSON
  tags: string;
  duration?: string; // If available
}
```

#### Features:
- **Layout**: Responsive grid (3-4 columns desktop, 2 mobile, 1 small screens)
- **Sorting**: Most recent episodes first
- **Language Toggle**: Filter episodes by language (EN/中文/한국어)
- **Episode Cards**:
  - Thumbnail image with hover effects
  - Episode date (formatted: "July 13, 2025")
  - Title (truncated if too long)
  - Language indicator badge
  - Headlines preview (2-3 key points)
- **Click Interaction**: Opens lightbox video player

#### Video Lightbox:
- **Background**: Dark overlay with backdrop blur
- **Player**: HTML5 video player (or YouTube embed if videos are hosted there)
- **Navigation**: 
  - Close button (X)
  - Previous/Next episode buttons
  - Episode index sidebar/bottom (all episodes in selected language)
- **Metadata Display**:
  - Episode title
  - Publication date
  - Full description
  - Headlines list
  - Tags

### 3. How It's Made Section
**Educational content about the AI production pipeline**

#### Components:
- `HowItsMade.tsx` - Main section container
- `ProcessStep.tsx` - Individual process step card
- `TechStack.tsx` - Technology overview
- `Statistics.tsx` - Production stats and achievements

#### Content Areas:
1. **Production Pipeline Overview**
   - Visual workflow diagram
   - 4-step process (Data → AI → 3D → Distribution)
   - Brief descriptions of each stage

2. **Technology Highlights**
   - AI content generation
   - 3D character animation
   - Multi-language support
   - Automated publishing

3. **Community Impact**
   - Daily episode production stats
   - Languages supported
   - Community contributions
   - Open source philosophy

4. **Call-to-Action**
   - Links to GitHub repository
   - Watch sample episodes
   - Join Discord community

## File System Integration

### Media Assets:
```
/public/
  /media/
    1.jpg → 16.jpg (hero slideshow images)
  /episodes/
    /2025-07-13/
      /thumbnail/
        thumbnail_en.jpg
        thumbnail_ch.jpg 
        thumbnail_ko.jpg
      /videos/ (if hosting locally)
        episode_en.mp4
        episode_ch.mp4
        episode_ko.mp4
```

### Data Loading:
- **Static Generation**: Pre-build episode index from file system
- **Build Script**: Node.js script to scan Episodes folder and generate JSON index
- **Metadata Extraction**: Parse YouTube metadata JSON files for titles/descriptions
- **Headlines Integration**: Load headline JSON files for episode previews

## Design System

### Color Palette:
```css
:root {
  --primary: #1a202c; /* Dark blue */
  --secondary: #4fd1c5; /* Teal accent */
  --background: #121212; /* Near black */
  --surface: #2d3748; /* Card backgrounds */
  --text-primary: #e2e8f0; /* Light gray */
  --text-secondary: #a0aec0; /* Medium gray */
  --accent: #38b2ac; /* Hover states */
}
```

### Typography:
- **Headlines**: Inter or Poppins (bold, clean)
- **Body**: System font stack for readability
- **Code/Tech**: JetBrains Mono for technical elements

### Components (shadcn/ui):
- `Button` - CTA buttons, navigation
- `Card` - Episode cards, info panels
- `Dialog` - Video lightbox modal
- `Badge` - Language indicators, tags
- `Tabs` - Language selection
- `ScrollArea` - Episode index in lightbox

## Responsive Breakpoints:
- **Mobile**: 320px - 767px (1 column)
- **Tablet**: 768px - 1023px (2 columns)
- **Desktop**: 1024px+ (3-4 columns)

## Performance Considerations:
- **Image Optimization**: WebP format with JPG fallbacks
- **Lazy Loading**: Intersection Observer for episode thumbnails
- **Video Streaming**: Consider YouTube embedding vs local hosting
- **Bundle Splitting**: Code split by routes/features
- **SEO**: Generate meta tags from episode metadata

## Development Phases:

### Phase 1: Core Structure
1. Set up React + Vite + Tailwind + shadcn/ui
2. Implement hero slideshow with static images
3. Create basic episode grid layout
4. Build episode data parsing utility

### Phase 2: Episode Integration
1. Implement language filtering
2. Add video lightbox with HTML5 player
3. Parse and display episode metadata
4. Add responsive design polish

### Phase 3: Enhanced Features
1. Build "How It's Made" section
2. Add smooth animations and transitions
3. Implement SEO optimization
4. Performance tuning and testing

### Phase 4: Production
1. Build automation and deployment
2. Analytics integration
3. Social media integration
4. Monitoring and maintenance

## File Organization:
```
src/
├── components/
│   ├── ui/ (shadcn components)
│   ├── Hero/
│   ├── Episodes/
│   └── HowItsMade/
├── hooks/
├── utils/
├── types/
├── data/
└── styles/
```

This plan provides a comprehensive foundation for building a professional AI News website that showcases the automated production capabilities while providing an excellent user experience for browsing and watching episodes.