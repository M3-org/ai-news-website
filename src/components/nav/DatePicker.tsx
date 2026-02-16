import { useState, useEffect } from 'react';

interface Props {
  currentDate: string;
  latestDate: string;
  basePath: string; // e.g. '/daily' or '/council'
}

export default function DatePicker({ currentDate, latestDate, basePath }: Props) {
  const [date, setDate] = useState(currentDate);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigate(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigate(1);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [date]);

  function navigate(days: number) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    const newDate = d.toISOString().split('T')[0];
    if (newDate > latestDate) return;
    window.location.href = `${basePath}/${newDate}`;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newDate = e.target.value;
    if (newDate) {
      window.location.href = `${basePath}/${newDate}`;
    }
  }

  return (
    <div className="date-nav">
      <button
        className="nav-btn"
        onClick={() => navigate(-1)}
        title="Previous day"
      >
        &larr;
      </button>
      <input
        type="date"
        className="date-input"
        value={date}
        max={latestDate}
        onChange={handleChange}
        title="Select date"
      />
      <button
        className="nav-btn"
        onClick={() => navigate(1)}
        disabled={date >= latestDate}
        title="Next day"
      >
        &rarr;
      </button>
    </div>
  );
}
