import type { CSSProperties } from "react";
import {
  EFFORT_HINT,
  EFFORT_LABEL,
  MODE_LABEL,
  SOURCE_LABEL,
  type Opportunity,
} from "../types.ts";

type OpportunityCardProps = {
  opportunity: Opportunity;
  maxScore: number;
};

export function OpportunityCard({ opportunity, maxScore }: OpportunityCardProps) {
  const share = maxScore > 0 ? Math.max(12, Math.round((opportunity.score / maxScore) * 100)) : 12;
  const hours = formatMetric(opportunity.timeSavedHoursPerWeek);

  return (
    <article className={`card mode-${opportunity.mode}`} data-testid="opportunity-card">
      <div className="card-rule" style={{ "--share": `${share}%` } as CSSProperties} />
      <div className="card-grid">
        <p className="rank" aria-label={`Rank ${opportunity.rank}`}>
          {String(opportunity.rank).padStart(2, "0")}
        </p>
        <div className="card-main">
          <div className="card-kicker">
            <span className={`mode mode-${opportunity.mode}`}>{MODE_LABEL[opportunity.mode]}</span>
            {opportunity.sources.map((source) => (
              <span key={source} className="source-pill">
                {SOURCE_LABEL[source]}
              </span>
            ))}
          </div>
          <h3>{opportunity.title}</h3>
          <p className="summary">{opportunity.summary}</p>
          {opportunity.evidence ? <blockquote>{opportunity.evidence}</blockquote> : null}
          <dl className="metrics">
            <div>
              <dt>Hours back</dt>
              <dd>
                {hours}
                <small>/wk</small>
              </dd>
            </div>
            <div>
              <dt>Setup</dt>
              <dd>
                {EFFORT_LABEL[opportunity.effort]}
                <small>{EFFORT_HINT[opportunity.effort]}</small>
              </dd>
            </div>
            <div>
              <dt>Return</dt>
              <dd>
                {opportunity.score.toFixed(1)}
                <small>{Math.round(opportunity.confidence * 100)}% sure</small>
              </dd>
            </div>
          </dl>
          <h4>What I need from you</h4>
          <ul className="needs">
            {opportunity.needs.map((need) => (
              <li key={need}>{need}</li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

function formatMetric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
