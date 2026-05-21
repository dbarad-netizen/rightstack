/* ============================================================================
   SCORING ENGINE  —  the "brains" of the platform.
   ----------------------------------------------------------------------------
   Flow:
     questionnaire answers
        -> deriveDomains()  : turn "goals" + "teams" into use-case domains
        -> prioritize()     : score each domain by Impact / Feasibility / Risk
                              and rank into Start here / Next / Later
        -> recommendTools() : for each domain, rank matching catalog tools

   Tune any number below without touching the app UI.
   ========================================================================== */

const USE_CASE_DOMAINS = {
  sales:      { label:"Sales & revenue",               impact:5, feas:4, risk:2,
                blurb:"Lead gen, outreach, CRM hygiene, and call/notes automation." },
  marketing:  { label:"Marketing & content",           impact:4, feas:5, risk:2,
                blurb:"Content production, SEO, creative, and campaign automation." },
  support:    { label:"Customer support",              impact:4, feas:4, risk:3,
                blurb:"Deflect tickets and answer customers with AI agents/chat." },
  knowledge:  { label:"Knowledge management",          impact:4, feas:3, risk:3,
                blurb:"Find answers across your docs, wikis, and internal apps." },
  docs:       { label:"Document & RFP automation",     impact:4, feas:3, risk:3,
                blurb:"Draft, review, and respond to RFPs, proposals, and contracts." },
  automation: { label:"Workflow & process automation", impact:5, feas:4, risk:2,
                blurb:"Remove repetitive manual steps across your tools." },
  data:       { label:"Data & analytics",              impact:4, feas:3, risk:3,
                blurb:"Self-serve analysis, reporting, and BI without a data team." },
  hr:         { label:"HR, training & recruiting",     impact:3, feas:4, risk:3,
                blurb:"Training content, onboarding, and recruiting support." },
  finance:    { label:"Finance & back office",         impact:4, feas:3, risk:4,
                blurb:"Spend, AP/AR, close, and financial analysis." },
  itdev:      { label:"IT & software development",     impact:4, feas:4, risk:2,
                blurb:"Ship code faster with AI pair programming and review." },
  meetings:   { label:"Meetings & productivity",       impact:3, feas:5, risk:1,
                blurb:"Auto notes, summaries, scheduling, and daily planning." }
};

/* Map the questionnaire's "What are you trying to achieve?" answers to domains. */
const GOAL_TO_DOMAINS = {
  efficiency: ["automation","meetings"],
  costs:      ["automation","finance"],
  marketing:  ["marketing"],
  automate:   ["automation"],
  support:    ["support"],
  content:    ["marketing"],
  sales:      ["sales"],
  data:       ["data"],
  aiproducts: ["itdev"]
};

/* Map the "Which teams will use these tools?" answers to domains. */
const TEAM_TO_DOMAINS = {
  marketing:  ["marketing"],
  sales:      ["sales"],
  operations: ["automation"],
  hr:         ["hr"],
  finance:    ["finance"],
  support:    ["support"],
  product:    ["itdev","data"],
  engineering:["itdev"]
};

/* Regulated industries carry more implementation risk. */
const INDUSTRY_RISK = { healthcare:1, finance:1, software:0, agency:0, ecommerce:0, other:0 };

function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

function uniq(arr){ const s={}; const out=[]; arr.forEach(function(x){ if(!s[x]){s[x]=1;out.push(x);} }); return out; }

/* Turn goals + teams into the set of use-case domains to prioritize.
   If the user skipped both, fall back to common high-value starting points. */
function deriveDomains(answers){
  let d = [];
  (answers.goals || []).forEach(function(g){ d = d.concat(GOAL_TO_DOMAINS[g] || []); });
  (answers.teams || []).forEach(function(t){ d = d.concat(TEAM_TO_DOMAINS[t] || []); });
  d = uniq(d);
  if(d.length === 0) d = ["automation","marketing","meetings","data"];   // sensible default
  return d;
}

const URGENCY_MOD = { low:-1, med:0, high:1 };
const COST_MOD    = { low:-1, med:0, high:1 };
const DATA_MOD    = { low:-1, med:0, high:1 };
const TECH_MOD    = { low:-1, med:0, high:1 };
const SEC_MOD     = { none:-1, some:0, strict:1 };

/* answers = {
     size, industry, goals:[], teams:[],
     budget:'free|low|mid|high|flex', urgency, techReadiness, security,
     (optional) cost, dataReadiness
   }                                                                          */
function prioritize(answers){
  const domains = (answers.domains && answers.domains.length) ? answers.domains : deriveDomains(answers);
  const indRisk = INDUSTRY_RISK[answers.industry] || 0;
  const out = [];

  domains.forEach(function(id){
    const d = USE_CASE_DOMAINS[id];
    if(!d) return;
    const impact = clamp(d.impact + (URGENCY_MOD[answers.urgency]||0) + (COST_MOD[answers.cost]||0), 1, 5);
    const feas   = clamp(d.feas + (DATA_MOD[answers.dataReadiness]||0) + (TECH_MOD[answers.techReadiness]||0), 1, 5);
    const risk   = clamp(d.risk + (SEC_MOD[answers.security]||0) + indRisk, 1, 5);
    const raw    = impact*0.5 + feas*0.35 + (6 - risk)*0.15;   // ~1..5
    const score  = Math.round(raw * 20);                       // 0..100
    out.push({
      id:id, label:d.label, blurb:d.blurb,
      impact:impact, feasibility:feas, risk:risk, score:score,
      band: score >= 75 ? "Start here" : score >= 55 ? "Next" : "Later"
    });
  });
  out.sort(function(a,b){ return b.score - a.score; });
  return out;
}

/* ----- tool matching within a domain ----- */
const TIER_RANK   = { free:0, low:1, mid:2, high:3 };
const BUDGET_RANK = { free:0, low:1, mid:2, high:3, flex:99 };

/* Score a single tool's fit against the answers (independent of use-case). */
function scoreToolFit(answers, t){
  const budget = answers.budget || "flex";
  const size   = (answers.size === "solo") ? "small" : (answers.size || "mid");
  const tech   = answers.techReadiness || "med";
  let s = 10; const reasons = [];

  if(budget === "free"){
    if(t.hasFreePlan){ s += 14; reasons.push("Free plan available"); } else { s -= 60; }
  } else if(budget === "flex"){ s += 6; }
  else {
    const diff = (TIER_RANK[t.priceTier]||0) - (BUDGET_RANK[budget]||0);
    if(diff <= 0){ s += 12; reasons.push("Fits your budget"); }
    else if(diff === 1){ s += 2; }
    else { s -= 14; }
  }
  if(t.hasFreePlan && budget !== "free"){ s += 4; }
  if(t.sizes.indexOf(size) !== -1){ s += 8; reasons.push("Built for your company size"); }
  if(tech === "low"){ s += (t.ease===1?10:t.ease===2?0:-10); if(t.ease===1) reasons.push("Easy, no-code setup"); }
  else if(tech === "med"){ s += (t.ease===1?5:t.ease===2?3:0); }

  return { score:s, reasons:reasons };
}

function complexityLabel(ease){ return ease===1 ? "Easy setup" : ease===2 ? "Moderate" : "Advanced"; }

/* Top tools for one use-case domain (used internally / for tests). */
function recommendTools(answers, domainId, tools, limit){
  limit = limit || 3;
  return tools
    .filter(function(t){ return t.tags.indexOf(domainId) !== -1; })
    .map(function(t){ const f = scoreToolFit(answers,t); return { tool:t, score:f.score, reasons:f.reasons }; })
    .filter(function(r){ return r.score > 0; })
    .sort(function(a,b){ return b.score - a.score; })
    .slice(0, limit);
}

/* One ranked, deduped list of every tool that matches the user's use-cases. */
function buildMatchedStack(answers, tools){
  const domains = (answers.domains && answers.domains.length) ? answers.domains : deriveDomains(answers);
  const out = [];
  tools.forEach(function(t){
    const covered = t.tags.filter(function(x){ return domains.indexOf(x) !== -1; });
    if(covered.length === 0) return;
    const f = scoreToolFit(answers, t);
    const score = f.score + 6 * (covered.length - 1);   // reward tools that cover multiple needs
    if(score <= 0) return;
    out.push({
      tool:t, score:score, reasons:f.reasons,
      coveredIds:covered,
      coveredLabels:covered.map(function(c){ return USE_CASE_DOMAINS[c] ? USE_CASE_DOMAINS[c].label : c; })
    });
  });
  out.sort(function(a,b){ return b.score - a.score; });
  return out;
}

if (typeof module !== "undefined" && module.exports){
  module.exports = { USE_CASE_DOMAINS, GOAL_TO_DOMAINS, TEAM_TO_DOMAINS, deriveDomains,
                     prioritize, scoreToolFit, complexityLabel, recommendTools, buildMatchedStack };
}
