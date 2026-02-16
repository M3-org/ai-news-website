import { useState } from 'react';

interface Props {
  contextHtml: string;
}

export default function MeetingContext({ contextHtml }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="meeting-context">
      <div
        className={`context-header ${expanded ? 'expanded' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="context-title">
          <span className="expand-icon">&#9654;</span>
          <span>North Star & Strategic Context</span>
        </div>
      </div>
      <div className={`context-content ${expanded ? 'expanded' : ''}`}>
        <div
          className="context-body"
          dangerouslySetInnerHTML={{ __html: contextHtml }}
        />
      </div>
    </div>
  );
}
