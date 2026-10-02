import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analysisFromModel, extractWeeklyHours, resolveMode, scoreTranscript } from "./score.ts";
import { sampleTranscript } from "./samples.ts";

describe("extractWeeklyHours", () => {
  it("turns a daily minute cost into a week", () => {
    assert.equal(
      extractWeeklyHours("Every morning I spend 20 minutes copying metrics.", 1),
      1.7,
    );
  });

  it("keeps a weekly hour cost", () => {
    assert.equal(extractWeeklyHours("I spend about 3.5 hours every Thursday.", 1), 3.5);
  });

  it("spreads a twice-monthly block across the week", () => {
    assert.equal(extractWeeklyHours("It takes about 2 hours and I do it twice a month.", 1), 0.9);
  });
});

describe("scoreTranscript", () => {
  it("ranks the sample desk by return, with sends held for review", () => {
    const analysis = scoreTranscript(sampleTranscript());
    assert.equal(analysis.engine, "offline");
    assert.deepEqual(
      analysis.opportunities.map((opportunity) => opportunity.id),
      [
        "competitor-grok",
        "newsletter-claude",
        "ads-codex",
        "script-codex",
        "checklist-workflow",
      ],
    );
    assert.equal(analysis.opportunities[0].timeSavedHoursPerWeek, 2);
    assert.equal(analysis.opportunities[0].mode, "automate");
    assert.equal(analysis.opportunities[1].timeSavedHoursPerWeek, 3.5);
    assert.equal(analysis.opportunities[1].mode, "handoff");
    assert.match(analysis.opportunities[1].summary, /handoff because you review sends/i);
    assert.equal(analysis.opportunities[2].timeSavedHoursPerWeek, 1.5);
    assert.equal(analysis.opportunities[3].mode, "optimize");
    assert.equal(analysis.opportunities[3].timeSavedHoursPerWeek, 0.8);
    assert.equal(analysis.hoursPerWeek, 8.7);
    assert.deepEqual(analysis.guardrails, [
      "Kenny reviews every consumer send himself. Never auto-publish.",
      "I always review the copy myself before it sends.",
    ]);
    assert.equal(analysis.opportunities[0].rank, 1);
    assert.ok(analysis.opportunities[0].score > analysis.opportunities[1].score);
  });

  it("scores a pasted morning ritual without source markers", () => {
    const analysis = scoreTranscript(
      "Every morning I spend 20 minutes copying campaign metrics into Slack before standup.",
    );
    assert.equal(analysis.opportunities.length, 1);
    assert.equal(analysis.opportunities[0].mode, "automate");
    assert.equal(analysis.opportunities[0].timeSavedHoursPerWeek, 1.7);
    assert.ok(analysis.opportunities[0].needs.length >= 2);
  });

  it("asks for more when the note is too short", () => {
    const analysis = scoreTranscript("hello");
    assert.equal(analysis.opportunities.length, 0);
    assert.match(analysis.headline, /Paste a conversation/i);
  });
});

describe("resolveMode", () => {
  it("will not fully automate a send when a memory forbids it", () => {
    assert.equal(
      resolveMode("automate", "Beehiiv newsletter draft", ["Never auto-publish."]),
      "handoff",
    );
    assert.equal(resolveMode("automate", "Monday ads sheet", ["Never auto-publish."]), "automate");
  });
});

describe("analysisFromModel", () => {
  it("clamps a model payload and ranks by return", () => {
    const analysis = analysisFromModel(
      {
        guardrails: ["Never auto-publish."],
        memories: ["Voice stays plain."],
        opportunities: [
          {
            title: "File the weekly brief",
            mode: "automate",
            summary: "Write it from the notes.",
            timeSavedHoursPerWeek: 5,
            effort: "low",
            confidence: 0.5,
            sources: ["claude"],
            needs: ["The notes folder"],
            evidence: "I do this every Friday.",
          },
          {
            title: "Rebuild the tracker",
            mode: "nope",
            summary: "Too vague.",
            timeSavedHoursPerWeek: 1,
            effort: "high",
            confidence: 2,
            sources: ["nope", "grok"],
            needs: [],
            evidence: "",
          },
        ],
      },
      "grok-4",
    );
    assert.equal(analysis.engine, "llm");
    assert.equal(analysis.model, "grok-4");
    assert.equal(analysis.opportunities[0].title, "File the weekly brief");
    assert.equal(analysis.opportunities[1].mode, "handoff");
    assert.equal(analysis.opportunities[1].timeSavedHoursPerWeek, 1);
    assert.deepEqual(analysis.opportunities[1].sources, ["grok"]);
    assert.equal(analysis.guardrails[0], "Never auto-publish.");
    assert.ok(analysis.opportunities[0].score > analysis.opportunities[1].score);
  });

  it("rejects an empty model payload", () => {
    assert.throws(() => analysisFromModel({ opportunities: [] }, "grok-4"), /no opportunities/i);
  });

  it("caps inflated hour estimates", () => {
    const analysis = analysisFromModel(
      {
        opportunities: [
          {
            title: "Inflated",
            mode: "automate",
            summary: "Too big.",
            timeSavedHoursPerWeek: 100,
            effort: "low",
            confidence: 0.5,
            sources: ["workflow"],
            needs: ["A source file"],
            evidence: "",
          },
        ],
      },
      "grok-4",
    );
    assert.equal(analysis.opportunities[0].timeSavedHoursPerWeek, 40);
  });
});
