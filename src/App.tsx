import { useMemo, useRef, useState } from "react";
import { OpportunityCard } from "./components/OpportunityCard.tsx";
import { SeatRing } from "./components/SeatRing.tsx";
import { SettingsDialog } from "./components/SettingsDialog.tsx";
import {
  clearCredentials,
  defaultCredentials,
  loadCredentials,
  saveCredentials,
  type Credentials,
} from "./credentials.ts";
import { PROMPT_SOURCE, SHARED_PROMPT } from "./prompt.ts";
import { rankWithModel } from "./rank-client.ts";
import { SAMPLE_SECTIONS, sampleTranscript, type SampleSection } from "./samples.ts";
import { detectSources, scoreTranscript } from "./score.ts";
import {
  MODE_LABEL,
  SOURCE_LABEL,
  type Analysis,
  type Mode,
  type Opportunity,
} from "./types.ts";

type SortKey = "return" | "hours" | "effort";
type FilterKey = "all" | Mode;

const EFFORT_ORDER = { low: 0, medium: 1, high: 2 } as const;

export function App() {
  const [transcript, setTranscript] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("return");
  const [useModel, setUseModel] = useState(false);
  const [credentials, setCredentials] = useState<Credentials>(() => loadCredentials());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);

  const activeSources = useMemo(() => detectSources(transcript), [transcript]);
  const visible = useMemo(() => {
    if (!analysis) return [];
    const filtered =
      filter === "all"
        ? analysis.opportunities
        : analysis.opportunities.filter((opportunity) => opportunity.mode === filter);
    return orderOpportunities(filtered, sort);
  }, [analysis, filter, sort]);
  const maxScore = analysis?.opportunities[0]?.score ?? 0;

  async function rank(nextTranscript = transcript) {
    setError(null);
    setNotice(null);
    const offline = scoreTranscript(nextTranscript);
    if (nextTranscript.trim().length < 40) {
      setAnalysis(offline);
      setError("Add a few more sentences. A conversation, a workflow, or a memory is enough.");
      return;
    }
    if (!useModel) {
      setAnalysis(offline);
      revealResults();
      return;
    }
    if (!credentials.apiKey.trim()) {
      setSettingsOpen(true);
      setError("Add a provider key, or stay on Offline.");
      return;
    }
    setBusy(true);
    try {
      const live = await rankWithModel({
        transcript: nextTranscript,
        apiKey: credentials.apiKey.trim(),
        baseUrl: credentials.baseUrl.trim(),
        model: credentials.model.trim(),
      });
      setAnalysis(live);
    } catch (caught) {
      setAnalysis(offline);
      const message = caught instanceof Error ? caught.message : "The model did not answer.";
      const key = credentials.apiKey.trim();
      setNotice(
        `${key ? message.split(key).join("[key]") : message} Showing the offline ranking instead.`,
      );
    } finally {
      setBusy(false);
      revealResults();
    }
  }

  function revealResults() {
    if (window.matchMedia("(max-width: 960px)").matches) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function loadSections(sections: SampleSection[]) {
    const next = sampleTranscript(sections);
    setTranscript(next);
    void rank(next);
  }

  function remember(next: Credentials, modelOn: boolean) {
    setCredentials(next);
    saveCredentials(next);
    setUseModel(modelOn && next.apiKey.trim().length > 0);
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">Kenny Kline · personal · kkcandc</p>
          <h1>Roundtable</h1>
        </div>
        <SeatRing active={activeSources} />
        <div className="top-actions">
          <div className="engine" role="group" aria-label="Scoring engine">
            <button
              type="button"
              aria-pressed={!useModel}
              onClick={() => setUseModel(false)}
            >
              Offline
            </button>
            <button
              type="button"
              aria-pressed={useModel}
              onClick={() => {
                if (!credentials.apiKey.trim()) {
                  setSettingsOpen(true);
                  return;
                }
                setUseModel(true);
              }}
            >
              Model
            </button>
          </div>
          <button type="button" className="text key-button" onClick={() => setSettingsOpen(true)}>
            {credentials.apiKey.trim() ? "Key saved" : "Add API key"}
          </button>
        </div>
      </header>

      <div className="workspace">
        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            void rank();
          }}
        >
          <p className="lede">
            Rank what to optimize, what to automate, and what you still want to approve.
          </p>
          <blockquote className="prompt">
            {SHARED_PROMPT.split("\n\n").map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </blockquote>
          <div className="prompt-actions">
            <a href={PROMPT_SOURCE}>Prompt source</a>
            <button
              type="button"
              className="text"
              onClick={() => {
                void navigator.clipboard.writeText(SHARED_PROMPT).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                });
              }}
            >
              {copied ? "Copied" : "Copy prompt"}
            </button>
          </div>

          <div className="chips" role="group" aria-label="Sample transcripts">
            <button
              type="button"
              className="chip strong"
              data-testid="load-sample"
              disabled={busy}
              onClick={() => loadSections(SAMPLE_SECTIONS)}
            >
              Sample desk
            </button>
            {SAMPLE_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className="chip"
                disabled={busy}
                onClick={() => loadSections([section])}
              >
                {SOURCE_LABEL[section.source]}
              </button>
            ))}
          </div>

          <label className="transcript-label" htmlFor="transcript">
            Conversations, workflows, and memories
          </label>
          <textarea
            id="transcript"
            data-testid="transcript"
            value={transcript}
            placeholder="Paste a Claude, Codex, or Grok thread, a checklist, or a memory. Or load the sample desk."
            onChange={(event) => setTranscript(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void rank();
              }
            }}
          />
          <div className="composer-foot">
            <p>{transcript.trim().length.toLocaleString()} characters</p>
            <button type="submit" className="primary" data-testid="rank-button" disabled={busy}>
              {busy ? "Reading the table…" : "Rank the opportunities"}
            </button>
          </div>
        </form>

        <main className="results" ref={resultsRef} aria-live="polite">
          {analysis ? (
            <Results
              analysis={analysis}
              visible={visible}
              maxScore={maxScore}
              filter={filter}
              sort={sort}
              error={error}
              notice={notice}
              onFilter={setFilter}
              onSort={setSort}
            />
          ) : (
            <EmptyState onSample={() => loadSections(SAMPLE_SECTIONS)} />
          )}
        </main>
      </div>

      <footer className="colophon">
        <p>
          Hours are estimated per opportunity and can overlap. Return is weekly hours × confidence
          ÷ setup weight (low 1, medium 2.2, high 4).
        </p>
        <p>Repo stays on kkcandc. Vercel project stays on Kenny Kline’s personal account.</p>
      </footer>

      <SettingsDialog
        open={settingsOpen}
        credentials={credentials}
        onClose={() => setSettingsOpen(false)}
        onSave={(next) => {
          remember(next, true);
          setSettingsOpen(false);
        }}
        onForget={() => {
          const empty = defaultCredentials();
          setCredentials(empty);
          clearCredentials();
          setUseModel(false);
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}

function orderOpportunities(opportunities: Opportunity[], sort: SortKey): Opportunity[] {
  const copy = [...opportunities];
  if (sort === "hours") {
    copy.sort((a, b) => b.timeSavedHoursPerWeek - a.timeSavedHoursPerWeek || a.rank - b.rank);
  } else if (sort === "effort") {
    copy.sort(
      (a, b) =>
        EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort] ||
        b.timeSavedHoursPerWeek - a.timeSavedHoursPerWeek,
    );
  }
  return copy;
}

type ResultsProps = {
  analysis: Analysis;
  visible: Opportunity[];
  maxScore: number;
  filter: FilterKey;
  sort: SortKey;
  error: string | null;
  notice: string | null;
  onFilter: (filter: FilterKey) => void;
  onSort: (sort: SortKey) => void;
};

function Results({
  analysis,
  visible,
  maxScore,
  filter,
  sort,
  error,
  notice,
  onFilter,
  onSort,
}: ResultsProps) {
  const counts = countModes(analysis.opportunities);
  return (
    <>
      <section className="ledger">
        <div>
          <p className="eyebrow">
            {analysis.engine === "llm" ? `Scored by ${analysis.model}` : "Scored on this machine"}
          </p>
          <h2 data-testid="hours-total">
            {formatHours(analysis.hoursPerWeek)}
            <span>h / week</span>
          </h2>
          <p className="headline">{analysis.headline}</p>
          <p className="formula">
            Return discounts weekly hours by confidence and setup time. Sort by Hours to put the
            longest tasks first. The numbers on the cards stay the return rank.
          </p>
        </div>
        <ul className="ledger-stats">
          <li>
            <strong>{counts.optimize}</strong>
            <span>Optimize</span>
          </li>
          <li>
            <strong>{counts.automate}</strong>
            <span>Automate</span>
          </li>
          <li>
            <strong>{counts.handoff}</strong>
            <span>Hand off</span>
          </li>
          <li>
            <strong>{formatHours(analysis.setupHours)}</strong>
            <span>Setup hours</span>
          </li>
        </ul>
      </section>

      {error ? <p className="banner error">{error}</p> : null}
      {notice ? <p className="banner notice">{notice}</p> : null}

      {analysis.guardrails.length > 0 ? (
        <section className="guardrails">
          <h3>Held by your memories</h3>
          <ul>
            {analysis.guardrails.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="controls">
        <div role="group" aria-label="Filter by kind of help">
          {(["all", "optimize", "automate", "handoff"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => onFilter(key)}
            >
              {key === "all" ? "All" : MODE_LABEL[key]}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Sort opportunities">
          {(
            [
              ["return", "Return"],
              ["hours", "Hours"],
              ["effort", "Easiest setup"],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" aria-pressed={sort === key} onClick={() => onSort(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="cards">
          {visible.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              maxScore={maxScore}
            />
          ))}
        </div>
      ) : (
        <p className="quiet">
          {analysis.opportunities.length === 0
            ? "No ranked moves yet."
            : "Nothing in this filter. Choose All to see the full ranking."}
        </p>
      )}

      {analysis.memories.length > 0 ? (
        <section className="memories">
          <h3>Memories read</h3>
          <ul>
            {analysis.memories.map((memory) => (
              <li key={memory}>{memory}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function EmptyState({ onSample }: { onSample: () => void }) {
  return (
    <section className="empty">
      <p className="eyebrow">The table is set</p>
      <h2>Paste the work you keep repeating.</h2>
      <p className="empty-copy">
        Roundtable reads what you can already access, then ranks the hours. It does not sign in
        to Claude, Codex, or Grok. You bring the transcript.
      </p>
      <ol className="modes">
        <li>
          <span className="mode mode-optimize">Optimize</span>
          Same work, fewer steps. You still do it.
        </li>
        <li>
          <span className="mode mode-automate">Automate</span>
          An agent can run it, including the file or the internal summary.
        </li>
        <li>
          <span className="mode mode-handoff">Hand off</span>
          An agent prepares it. You approve anything that sends.
        </li>
      </ol>
      <button type="button" className="primary" onClick={onSample}>
        Review the sample desk
      </button>
    </section>
  );
}

function countModes(opportunities: Opportunity[]) {
  return {
    optimize: opportunities.filter((opportunity) => opportunity.mode === "optimize").length,
    automate: opportunities.filter((opportunity) => opportunity.mode === "automate").length,
    handoff: opportunities.filter((opportunity) => opportunity.mode === "handoff").length,
  };
}

function formatHours(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
