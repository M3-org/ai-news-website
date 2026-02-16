import { useState } from 'react';

interface Props {
  focus: string;
  monthlyGoal: string;
}

export default function DailyFocus({ focus, monthlyGoal }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="daily-focus">
      <div
        className={`focus-header ${expanded ? 'expanded' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="focus-label">
          <span className="expand-icon">&#9654;</span>
          Daily Strategic Focus
        </div>
      </div>
      <div className="focus-text">{focus}</div>
      <div className={`focus-content ${expanded ? 'expanded' : ''}`}>
        <div className="monthly-goal">
          <div className="monthly-label">Monthly Goal</div>
          <div className="monthly-text">{monthlyGoal}</div>
        </div>
      </div>
    </div>
  );
}
