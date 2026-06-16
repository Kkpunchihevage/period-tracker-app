import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Droplets,
  HeartPulse,
  Moon,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Waves,
} from 'lucide-react';
import './styles.css';

const STORAGE_KEY = 'lunaflow.tracker.v1';
const today = new Date();

const pad = (value) => String(value).padStart(2, '0');
const toKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromKey = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
const dayDiff = (a, b) => Math.round((toMidnight(a) - toMidnight(b)) / 86400000);
const toMidnight = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const monthLabel = (date) => date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const prettyDate = (key) => fromKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const defaultState = {
  periodDates: [],
  cycleLength: 28,
  periodLength: 5,
  reminderLead: 2,
  notifications: false,
  logs: {},
};

const tips = {
  period: [
    'Choose iron-rich meals, warm drinks, and slower movement while bleeding is heavier.',
    'Cramps can ease with heat, hydration, gentle stretching, and rest blocks.',
    'Track pain that interrupts daily life so you can discuss patterns with a clinician.',
  ],
  follicular: [
    'Energy often rises now, so it can be a good time for strength training or planning.',
    'Add colorful plants and protein to support hormone production and steady focus.',
    'Use this lighter phase to notice what habits make your next period easier.',
  ],
  ovulation: [
    'Cervical fluid may change around ovulation; logging it can improve predictions.',
    'Prioritize sleep and hydration if you feel warmer, social, or more sensitive.',
    'If pregnancy prevention matters, use reliable contraception during fertile days.',
  ],
  luteal: [
    'Magnesium-rich foods, steady meals, and lower caffeine can soften PMS symptoms.',
    'Schedule demanding work earlier in the day if your mood or focus dips.',
    'Bloating and tenderness are common, but severe symptoms deserve medical care.',
  ],
};

const moodOptions = ['Calm', 'Bright', 'Tender', 'Tired', 'Irritable'];
const flowOptions = ['Spotting', 'Light', 'Medium', 'Heavy'];
const symptomOptions = ['Cramps', 'Headache', 'Bloating', 'Acne', 'Back pain', 'Cravings'];

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed ? { ...defaultState, ...parsed } : defaultState;
  } catch {
    return defaultState;
  }
}

function getPeriodStarts(periodDates) {
  return [...periodDates]
    .sort()
    .filter((key, index, sorted) => index === 0 || dayDiff(fromKey(key), fromKey(sorted[index - 1])) > 1);
}

function predictNextStart(periodDates, cycleLength) {
  const starts = getPeriodStarts(periodDates);
  if (!starts.length) return toKey(today);
  let predicted = addDays(fromKey(starts.at(-1)), cycleLength);
  while (dayDiff(today, predicted) > 0) predicted = addDays(predicted, cycleLength);
  return toKey(predicted);
}

function phaseForDate(dateKey, periodDates, cycleLength, periodLength) {
  if (periodDates.includes(dateKey)) return 'period';
  const starts = getPeriodStarts(periodDates);
  if (!starts.length) return 'follicular';
  let anchor = fromKey(starts[0]);
  starts.forEach((start) => {
    if (fromKey(start) <= fromKey(dateKey)) anchor = fromKey(start);
  });
  if (fromKey(dateKey) < anchor) anchor = addDays(anchor, -cycleLength);
  const cycleDay = ((dayDiff(fromKey(dateKey), anchor) % cycleLength) + cycleLength) % cycleLength + 1;
  if (cycleDay <= periodLength) return 'period';
  if (cycleDay >= cycleLength - 16 && cycleDay <= cycleLength - 12) return 'ovulation';
  if (cycleDay > cycleLength - 12) return 'luteal';
  return 'follicular';
}

function getMonthDays(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function App() {
  const [data, setData] = useState(loadState);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(toKey(today));
  const [toast, setToast] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (!data.notifications || Notification.permission !== 'granted') return;
    const next = predictNextStart(data.periodDates, data.cycleLength);
    const daysAway = dayDiff(fromKey(next), today);
    if (daysAway <= data.reminderLead && daysAway >= 0) {
      const stamp = `notified-${next}`;
      if (localStorage.getItem(stamp)) return;
      new Notification('LunaFlow reminder', {
        body: `Your predicted period is ${daysAway === 0 ? 'today' : `in ${daysAway} day${daysAway === 1 ? '' : 's'}`}.`,
      });
      localStorage.setItem(stamp, 'true');
    }
  }, [data]);

  const predictions = useMemo(() => {
    const nextStart = predictNextStart(data.periodDates, data.cycleLength);
    const nextPeriod = Array.from({ length: data.periodLength }, (_, i) => toKey(addDays(fromKey(nextStart), i)));
    const ovulation = toKey(addDays(fromKey(nextStart), -14));
    const fertile = Array.from({ length: 6 }, (_, i) => toKey(addDays(fromKey(ovulation), i - 4)));
    return { nextStart, nextPeriod, ovulation, fertile };
  }, [data.periodDates, data.cycleLength, data.periodLength]);

  const currentPhase = phaseForDate(selectedDate, data.periodDates, data.cycleLength, data.periodLength);
  const selectedLog = data.logs[selectedDate] || { mood: '', flow: '', symptoms: [], note: '' };
  const daysToNext = dayDiff(fromKey(predictions.nextStart), today);
  const completion = Math.max(0, Math.min(100, 100 - (daysToNext / data.cycleLength) * 100));

  const togglePeriodDate = (dateKey) => {
    setSelectedDate(dateKey);
    setData((current) => {
      const exists = current.periodDates.includes(dateKey);
      const periodDates = exists
        ? current.periodDates.filter((key) => key !== dateKey)
        : [...current.periodDates, dateKey].sort();
      return { ...current, periodDates };
    });
  };

  const updateLog = (patch) => {
    setData((current) => ({
      ...current,
      logs: {
        ...current.logs,
        [selectedDate]: { ...selectedLog, ...patch },
      },
    }));
  };

  const toggleSymptom = (symptom) => {
    const symptoms = selectedLog.symptoms.includes(symptom)
      ? selectedLog.symptoms.filter((item) => item !== symptom)
      : [...selectedLog.symptoms, symptom];
    updateLog({ symptoms });
  };

  const askNotifications = async () => {
    if (!('Notification' in window)) {
      setToast('This browser does not support desktop notifications.');
      return;
    }
    const permission = await Notification.requestPermission();
    setData((current) => ({ ...current, notifications: permission === 'granted' }));
    setToast(permission === 'granted' ? 'Notifications are ready when the app is open.' : 'Notification permission was not enabled.');
  };

  const clearAll = () => {
    setData(defaultState);
    localStorage.removeItem(STORAGE_KEY);
    setToast('Tracker data cleared from this browser.');
  };

  const monthDays = getMonthDays(viewDate);
  const markedCount = data.periodDates.length;
  const averageCycle = useMemo(() => {
    const starts = getPeriodStarts(data.periodDates).map(fromKey);
    if (starts.length < 2) return data.cycleLength;
    const gaps = starts.slice(1).map((start, index) => dayDiff(start, starts[index]));
    return Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length);
  }, [data.periodDates, data.cycleLength]);

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow"><Moon size={16} /> Private cycle companion</p>
          <h1>LunaFlow</h1>
          <p className="hero-text">
            Mark period days, understand your cycle rhythm, and keep gentle reminders and care tips close when your body needs them.
          </p>
          <div className="hero-actions">
            <button onClick={() => togglePeriodDate(toKey(today))} className="primary-button">
              <Plus size={18} /> Mark today
            </button>
            <button onClick={askNotifications} className="secondary-button">
              <Bell size={18} /> Enable reminders
            </button>
          </div>
        </div>
        <div className="orbital-card" aria-label="Cycle progress">
          <div className="cycle-ring" style={{ '--progress': `${completion}%` }}>
            <div>
              <span>{daysToNext === 0 ? 'Today' : Math.max(daysToNext, 0)}</span>
              <small>{daysToNext === 0 ? 'predicted start' : 'days to next'}</small>
            </div>
          </div>
          <div className="mini-forecast">
            <span>Next period</span>
            <strong>{prettyDate(predictions.nextStart)}</strong>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel calendar-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow"><CalendarDays size={15} /> Calendar</p>
              <h2>{monthLabel(viewDate)}</h2>
            </div>
            <div className="icon-row">
              <button aria-label="Previous month" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>
                <ChevronLeft size={19} />
              </button>
              <button aria-label="Next month" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>
                <ChevronRight size={19} />
              </button>
            </div>
          </div>
          <div className="weekday-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="calendar-grid">
            {monthDays.map((date) => {
              const dateKey = toKey(date);
              const isCurrentMonth = date.getMonth() === viewDate.getMonth();
              const isPeriod = data.periodDates.includes(dateKey);
              const isPredicted = predictions.nextPeriod.includes(dateKey);
              const isFertile = predictions.fertile.includes(dateKey);
              const isOvulation = predictions.ovulation === dateKey;
              const isSelected = selectedDate === dateKey;
              return (
                <button
                  key={dateKey}
                  onClick={() => togglePeriodDate(dateKey)}
                  className={[
                    'day-cell',
                    isCurrentMonth ? '' : 'muted',
                    isPeriod ? 'period' : '',
                    isPredicted ? 'predicted' : '',
                    isFertile ? 'fertile' : '',
                    isOvulation ? 'ovulation' : '',
                    isSelected ? 'selected' : '',
                    dateKey === toKey(today) ? 'today' : '',
                  ].join(' ')}
                  aria-label={`Toggle period date ${dateKey}`}
                >
                  <span>{date.getDate()}</span>
                  {isPeriod && <Droplets size={14} />}
                </button>
              );
            })}
          </div>
          <div className="legend">
            <span><i className="period-dot" /> Period</span>
            <span><i className="predicted-dot" /> Predicted</span>
            <span><i className="fertile-dot" /> Fertile</span>
          </div>
        </article>

        <aside className="panel log-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow"><Sparkles size={15} /> Daily log</p>
              <h2>{prettyDate(selectedDate)}</h2>
            </div>
            <span className={`phase-pill ${currentPhase}`}>{currentPhase}</span>
          </div>

          <label className="field-label">Mood</label>
          <div className="chip-row">
            {moodOptions.map((mood) => (
              <button key={mood} onClick={() => updateLog({ mood })} className={selectedLog.mood === mood ? 'chip active' : 'chip'}>{mood}</button>
            ))}
          </div>

          <label className="field-label">Flow</label>
          <div className="chip-row">
            {flowOptions.map((flow) => (
              <button key={flow} onClick={() => updateLog({ flow })} className={selectedLog.flow === flow ? 'chip active' : 'chip'}>{flow}</button>
            ))}
          </div>

          <label className="field-label">Symptoms</label>
          <div className="chip-row">
            {symptomOptions.map((symptom) => (
              <button key={symptom} onClick={() => toggleSymptom(symptom)} className={selectedLog.symptoms.includes(symptom) ? 'chip active' : 'chip'}>{symptom}</button>
            ))}
          </div>

          <label className="field-label" htmlFor="note">Notes</label>
          <textarea
            id="note"
            value={selectedLog.note}
            onChange={(event) => updateLog({ note: event.target.value })}
            placeholder="Energy, cravings, pain level, medication, sleep..."
          />
        </aside>
      </section>

      <section className="insight-grid">
        <article className="panel stat-panel">
          <HeartPulse size={24} />
          <span>Average cycle</span>
          <strong>{averageCycle} days</strong>
        </article>
        <article className="panel stat-panel">
          <Waves size={24} />
          <span>Marked period days</span>
          <strong>{markedCount}</strong>
        </article>
        <article className="panel stat-panel">
          <Sun size={24} />
          <span>Ovulation estimate</span>
          <strong>{prettyDate(predictions.ovulation)}</strong>
        </article>
        <article className="panel stat-panel">
          <ShieldCheck size={24} />
          <span>Privacy</span>
          <strong>Stored locally</strong>
        </article>
      </section>

      <section className="bottom-grid">
        <article className="panel settings-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow"><RotateCcw size={15} /> Cycle setup</p>
              <h2>Personalize predictions</h2>
            </div>
          </div>
          <div className="range-field">
            <label>Cycle length <strong>{data.cycleLength} days</strong></label>
            <input type="range" min="21" max="40" value={data.cycleLength} onChange={(event) => setData({ ...data, cycleLength: Number(event.target.value) })} />
          </div>
          <div className="range-field">
            <label>Period length <strong>{data.periodLength} days</strong></label>
            <input type="range" min="2" max="9" value={data.periodLength} onChange={(event) => setData({ ...data, periodLength: Number(event.target.value) })} />
          </div>
          <div className="range-field">
            <label>Reminder lead <strong>{data.reminderLead} days before</strong></label>
            <input type="range" min="0" max="7" value={data.reminderLead} onChange={(event) => setData({ ...data, reminderLead: Number(event.target.value) })} />
          </div>
          <button className="danger-button" onClick={clearAll}><Trash2 size={17} /> Clear local data</button>
        </article>

        <article className="panel tips-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow"><HeartPulse size={15} /> Health tips</p>
              <h2>{currentPhase} phase care</h2>
            </div>
          </div>
          <div className="tip-list">
            {tips[currentPhase].map((tip) => (
              <div className="tip-card" key={tip}>
                <Sparkles size={17} />
                <p>{tip}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <footer>
        <span>Cycle predictions are estimates and not medical advice.</span>
        {toast && <button className="toast" onClick={() => setToast('')}>{toast}</button>}
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
