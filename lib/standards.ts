export type Standard = { code: string; slug: string; name: string; available: boolean };
export type Principle = { label: string; standards: Standard[] };
export type Domain = { domain: string; principles: Principle[] };

// slug = code with dot replaced by dash (so URLs have no dots, e.g. 1.1 -> 1-1)
const s = (code: string, name: string, available = false): Standard => ({
  code, slug: code.replace(".", "-"), name, available,
});

export const STRUCTURE: Domain[] = [
  { domain: "Domain II: Ethics and Professionalism", principles: [
    { label: "Principle 1 — Demonstrate Integrity", standards: [
      s("1.1", "Honesty and Professional Courage", true),
      s("1.2", "Organization's Ethical Expectations"),
      s("1.3", "Legal and Ethical Behavior"),
    ]},
    { label: "Principle 2 — Maintain Objectivity", standards: [
      s("2.1", "Individual Objectivity"),
      s("2.2", "Safeguarding Objectivity"),
      s("2.3", "Disclosing Impairments to Objectivity"),
    ]},
    { label: "Principle 3 — Demonstrate Competency", standards: [
      s("3.1", "Competency"),
      s("3.2", "Continuing Professional Development"),
    ]},
    { label: "Principle 4 — Exercise Due Professional Care", standards: [
      s("4.1", "Conformance with the Global Internal Audit Standards"),
      s("4.2", "Due Professional Care"),
      s("4.3", "Professional Skepticism"),
    ]},
    { label: "Principle 5 — Maintain Confidentiality", standards: [
      s("5.1", "Use of Information"),
      s("5.2", "Protection of Information"),
    ]},
  ]},
  { domain: "Domain III: Governing the Internal Audit Function", principles: [
    { label: "Principle 6 — Authorized by the Board", standards: [
      s("6.1", "Internal Audit Mandate"),
      s("6.2", "Internal Audit Charter"),
      s("6.3", "Board and Senior Management Support"),
    ]},
    { label: "Principle 7 — Positioned Independently", standards: [
      s("7.1", "Organizational Independence"),
      s("7.2", "Chief Audit Executive Qualifications"),
    ]},
    { label: "Principle 8 — Overseen by the Board", standards: [
      s("8.1", "Board Interaction"),
      s("8.2", "Resources"),
      s("8.3", "Quality"),
      s("8.4", "External Quality Assessment"),
    ]},
  ]},
  { domain: "Domain IV: Managing the Internal Audit Function", principles: [
    { label: "Principle 9 — Plan Strategically", standards: [
      s("9.1", "Understanding Governance, Risk Management, and Control Processes"),
      s("9.2", "Internal Audit Strategy"),
      s("9.3", "Methodologies"),
      s("9.4", "Internal Audit Plan"),
      s("9.5", "Coordination and Reliance"),
    ]},
    { label: "Principle 10 — Manage Resources", standards: [
      s("10.1", "Financial Resource Management"),
      s("10.2", "Human Resources Management"),
      s("10.3", "Technological Resources"),
    ]},
    { label: "Principle 11 — Communicate Effectively", standards: [
      s("11.1", "Building Relationships and Communicating with Stakeholders"),
      s("11.2", "Effective Communication"),
      s("11.3", "Communicating Results"),
      s("11.4", "Errors and Omissions"),
      s("11.5", "Communicating the Acceptance of Risks"),
    ]},
    { label: "Principle 12 — Enhance Quality", standards: [
      s("12.1", "Internal Quality Assessment"),
      s("12.2", "Performance Measurement"),
      s("12.3", "Oversee and Improve Engagement Performance"),
    ]},
  ]},
  { domain: "Domain V: Performing Internal Audit Services", principles: [
    { label: "Principle 13 — Plan Engagements Effectively", standards: [
      s("13.1", "Engagement Communication"),
      s("13.2", "Engagement Risk Assessment"),
      s("13.3", "Engagement Objectives and Scope"),
      s("13.4", "Evaluation Criteria"),
      s("13.5", "Engagement Resources"),
      s("13.6", "Work Program"),
    ]},
    { label: "Principle 14 — Conduct Engagement Work", standards: [
      s("14.1", "Gathering Information for Analyses and Evaluation"),
      s("14.2", "Analyses and Potential Engagement Findings"),
      s("14.3", "Evaluation of Findings"),
      s("14.4", "Recommendations and Action Plans"),
      s("14.5", "Engagement Conclusions"),
      s("14.6", "Engagement Documentation"),
    ]},
    { label: "Principle 15 — Communicate Engagement Results and Monitor Action Plans", standards: [
      s("15.1", "Final Engagement Communication"),
      s("15.2", "Confirming the Implementation of Recommendations or Action Plans"),
    ]},
  ]},
];

export function findStandard(slug: string): Standard | undefined {
  for (const d of STRUCTURE)
    for (const p of d.principles)
      for (const st of p.standards)
        if (st.slug === slug) return st;
  return undefined;
}
