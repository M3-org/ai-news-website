// Knowledge manifest
export interface Manifest {
  version: string;
  generated_at: string;
  latest: {
    facts: string;
    council_briefing: string;
    aggregated: string;
    github_week: string;
    github_day: string;
    github_month: string;
    ai_news_json: string;
    ai_news_md: string;
    daily_silk: string;
    hackmd_facts: string;
    highlights: string;
    retros: string;
    help_reports: string;
  };
  available_dates?: Record<string, string[]>;
  available_months?: string[];
  data_sources: Record<string, {
    path_template: string;
    signal_value: string;
    description: string;
    update_frequency: string;
    use_case: string;
    file_count: number;
    size_mb: number;
  }>;
}

// Facts data
export interface FactsData {
  briefing_date: string;
  overall_summary: string;
  key_facts: string[];
  open_questions: string[];
  tags: {
    themes: string[];
    sentiment: {
      overall: string;
      context: string[];
    };
    story_type: string[];
    derived: string[];
    priority: string[];
    manual: string[];
  };
  categories: {
    twitter_news_highlights: TwitterHighlight[];
    github_updates: {
      new_issues_prs: GitHubItem[];
    };
    discord_updates: DiscordUpdate[];
    strategic_insights: StrategicInsight[];
    market_analysis: MarketAnalysis[];
    user_feedback: UserFeedback[];
  };
  images?: string[];
  videos?: string[];
}

export interface TwitterHighlight {
  claim: string;
  source: string;
  sentiment?: string;
}

export interface GitHubItem {
  item_type: string;
  title: string;
  number: number;
  url: string;
  status: string;
  author: string;
  significance: string;
}

export interface DiscordUpdate {
  channel: string;
  summary: string;
  key_participants?: string[];
  source?: string;
}

export interface StrategicInsight {
  theme?: string;
  insight?: string;
  observation?: string;
  summary?: string;
  relevance?: string;
  implications_or_questions?: string[];
  priority?: string;
}

export interface MarketAnalysis {
  observation?: string;
  analysis?: string;
  summary?: string;
  trend?: string;
  relevance?: string;
  implications_or_questions?: string[];
}

export interface UserFeedback {
  feedback_summary: string;
  source?: string;
  sentiment?: string;
}

// Council briefing
export interface CouncilBriefing {
  date: string;
  meeting_context: string;
  monthly_goal: string;
  daily_focus: string;
  key_points: KeyPoint[];
}

export interface KeyPoint {
  topic: string;
  summary: string;
  deliberation_items: DeliberationItem[];
}

export interface DeliberationItem {
  question_id: string;
  text: string;
  context: string[];
  multiple_choice_answers: Record<string, {
    text: string;
    implication: string | null;
  }>;
}

// Highlights
export interface HighlightsData {
  summary?: string;
  highlights: Highlight[];
}

export interface Highlight {
  character: string;
  headline: string;
  body: string;
  sources?: string[];
}

// AI News
export interface AiNewsData {
  categories: AiNewsCategory[] | AiNewsCategory | Record<string, AiNewsCategory>;
}

export interface AiNewsCategory {
  topic?: string;
  title?: string;
  content: AiNewsStory[];
}

export interface AiNewsStory {
  text: string;
  sources?: string | string[];
  posters?: string | string[];
  images?: string | string[];
  memes?: { url?: string | string[] };
}

// GitHub stats
export interface GitHubStats {
  newPRs?: number;
  mergedPRs?: number;
  newIssues?: number;
  closedIssues?: number;
  activeContributors?: number;
  topContributors?: {
    username: string;
    avatarUrl: string;
    totalScore: number;
  }[];
  overview?: string;
  codeChanges?: {
    additions: number;
    deletions: number;
    files: number;
    commitCount: number;
  };
}

// Character info
export interface CharacterInfo {
  name: string;
  title: string;
  color: string;
}

export const CHARACTERS: Record<string, CharacterInfo> = {
  eliza: { name: 'Eliza', title: 'Moderator', color: '#f97316' },
  shaw: { name: 'AI Shaw', title: 'Technical', color: '#3b82f6' },
  marc: { name: 'AI Marc', title: 'Strategy', color: '#a855f7' },
  spartan: { name: 'Degen Spartan AI', title: 'Markets', color: '#ef4444' },
  peepo: { name: 'Peepo', title: 'Community', color: '#22c55e' },
};
