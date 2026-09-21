import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Groq from 'groq-sdk';
import {
  INITIAL_SEARCH_SYSTEM_PROMPT,
  REFINEMENT_SYSTEM_PROMPT,
  RUBRIC_SCORING_SYSTEM_PROMPT,
} from '@/lib/prompt';
import {
  buildSearchPrompt,
  buildRefinePrompt,
  buildScorePrompt
} from '@/lib/utils';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const PRIMARY_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

async function callLLM(systemPrompt, userContent) {

  const res = await groq.chat.completions.create({
    model: PRIMARY_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1
  });
  return JSON.parse(res.choices[0].message.content);
}

function loadProfiles() {
  const filePath = path.join(process.cwd(), 'profiles.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Deterministic Regex Parser: Acts as a safeguard over LLM hallucinations for experience bounds.
 */
function applyExperienceGuardrails(text, currentFilters = {}) {
  const t = (text || '').toLowerCase();
  let min = currentFilters.min_exp ?? null;
  let max = currentFilters.max_exp ?? null;

  const rangeMatch = t.match(/(\d+)\s*(?:-|to)\s*(\d+)\s*years?/i);
  const maxMatch = t.match(/(?:less than|under|maximum|max|at most|<=|<)\s*(\d+)\s*years?/i);
  const minMatch = t.match(/(?:more than|over|minimum|min|at least|>=|>)\s*(\d+)\s*years?/i);

  if (rangeMatch) {
    min = parseInt(rangeMatch[1], 10);
    max = parseInt(rangeMatch[2], 10);
  } else {
    if (maxMatch) {
      max = parseInt(maxMatch[1], 10);
      // Reset min if the user only specified an upper bound
      if (!minMatch && !t.includes('minimum') && !t.includes('at least')) {
        min = null;
      }
    }
    if (minMatch) {
      min = parseInt(minMatch[1], 10);
      if (!maxMatch && !t.includes('maximum') && !t.includes('less than')) {
        max = null;
      }
    }
  }

  return { min_exp: min, max_exp: max };
}

function deriveRoleFocus(text = '', fallback = null) {
  if (fallback) return fallback;
  const q = (text || '').toLowerCase();
  if (/\bfront[\s-]?end\b|react|vue|angular|next\.?js|ui engineer/i.test(q)) return 'Frontend';
  if (/\bback[\s-]?end\b|node|django|flask|golang|postgres|rds|sql/i.test(q)) return 'Backend';
  if (/\bfull[\s-]?stack\b/i.test(q)) return 'Full Stack';
  if (/\bdevops\b|sre|kubernetes|docker|terraform|aws/i.test(q)) return 'DevOps';
  return null;
}

function matchesRole(candidate, roleFocus) {
  if (!roleFocus) return true;
  const rf = roleFocus.toLowerCase();
  const text = `${candidate.current_title} ${candidate.summary} ${(candidate.skills || []).join(' ')}`.toLowerCase();

  if (rf === 'frontend') {
    return text.includes('react') || text.includes('frontend') || text.includes('front-end') || text.includes('ui');
  }
  if (rf === 'backend') {
    return text.includes('backend') || text.includes('database') || text.includes('node') || text.includes('rds');
  }
  if (rf === 'devops') {
    return text.includes('devops') || text.includes('sre') || text.includes('infrastructure') || text.includes('terraform');
  }
  return text.includes(rf);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      action = 'search',
      query = '',
      feedback = '',
      currentFilters = {},
      currentRubric = [],
      candidatesContext = [],
      shortlistedIds = [],
      rejectedIds = []
    } = body;

    const allProfiles = loadProfiles();
    let filters = { ...currentFilters };
    let rubric = [...currentRubric];
    let changelog = "Search executed.";
    let notice = null;

    // =========================================================================
    // 1. LLM Extraction / Refinement + Regex Guardrails
    // =========================================================================
    if (action === 'search') {
      const parsed = await callLLM(INITIAL_SEARCH_SYSTEM_PROMPT, buildSearchPrompt(query));
      const raw = parsed.objective_filters || {};

      filters = {
        role_focus: raw.role_focus || deriveRoleFocus(query),
        min_exp: raw.min_exp !== undefined ? raw.min_exp : null,
        max_exp: raw.max_exp !== undefined ? raw.max_exp : null,
        skills: raw.skills || [],
        locations: raw.locations || [],
        company_types: (raw.company_types || []).filter(c => c !== 'any')
      };

      // Apply deterministic regex override
      const expOverride = applyExperienceGuardrails(query, filters);
      if (expOverride.min_exp !== null) filters.min_exp = expOverride.min_exp;
      if (expOverride.max_exp !== null) filters.max_exp = expOverride.max_exp;

      rubric = parsed.subjective_rubric || [];

    } else if (action === 'refine') {
      const parsed = await callLLM(
        REFINEMENT_SYSTEM_PROMPT,
        buildRefinePrompt(currentFilters, currentRubric, feedback, candidatesContext)
      );
      const raw = parsed.updated_filters || {};

      const prevRole = (currentFilters.role_focus || '').toLowerCase();
      const nextRole = (raw.role_focus || deriveRoleFocus(feedback) || prevRole).toLowerCase();

      const roleChanged = prevRole && nextRole && prevRole !== nextRole;

      const baseFilters = {
          min_exp: raw.min_exp !== undefined ? raw.min_exp : currentFilters?.min_exp,
          max_exp: raw.max_exp !== undefined ? raw.max_exp : currentFilters?.max_exp
        };

        // 3. DECLARE expOverride FIRST
        const expOverride = applyExperienceGuardrails(feedback, baseFilters);

        // 4. NOW construct the final filters object safely
        filters = {
          role_focus: raw.role_focus || currentFilters?.role_focus || deriveRoleFocus(feedback),
          min_exp: expOverride.min_exp,
          max_exp: expOverride.max_exp,
          skills: roleChanged ? (raw.skills || []) : (raw.skills || currentFilters?.skills || []),
          locations: raw.locations || currentFilters?.locations || [],
          company_types: (raw.company_types || currentFilters?.company_types || []).filter(c => c !== 'any')
        };

        rubric = parsed.updated_rubric || currentRubric;
        changelog = parsed.changelog?.summary || "Filters updated based on feedback.";
          
      }

    // Safety check: ensure min <= max if both exist
    if (filters.min_exp !== null && filters.max_exp !== null && filters.min_exp > filters.max_exp) {
      filters.min_exp = null;
    }

    // =========================================================================
    // 2. Deterministic Local Filter Engine
    // =========================================================================
    const filterFn = (candidate, relaxMode = 0) => {
      if (rejectedIds?.includes(candidate.id)) return false;

      // RULE 1: Experience is ALWAYS strictly enforced
      const exp = candidate.years_experience ?? 0;
      if (filters.min_exp !== null && exp < filters.min_exp) return false;
      if (filters.max_exp !== null && exp > filters.max_exp) return false;

      // RULE 2: Role domain is ALWAYS strictly enforced
      if (!matchesRole(candidate, filters.role_focus)) return false;

      // relaxMode: 0 = Strict, 1 = Relax Locations, 2 = Relax Locations + Company Types
      if (relaxMode < 2 && filters.company_types?.length > 0) {
        const past = (candidate.past_companies || []).map(c => (c.company_type || '').toLowerCase());
        const curr = (candidate.current_company_type || '').toLowerCase();
        const hasCompany = filters.company_types.some(t => curr === t.toLowerCase() || past.includes(t.toLowerCase()));
        if (!hasCompany) return false;
      }

      if (relaxMode < 1 && filters.locations?.length > 0) {
        const candLoc = (candidate.location || '').toLowerCase();
        const matchesLoc = filters.locations.some(loc => {
          const l = loc.toLowerCase();
          return candLoc.includes(l) || l.includes(candLoc) || (l.includes('bangalore') && candLoc.includes('bengaluru'));
        });
        if (!matchesLoc) return false;
      }

      return true;
    };

    // Stage 1: Strict matching
    let matches = allProfiles.filter(p => filterFn(p, 0));

    // Stage 2: Fallback 1 - Relax location (e.g. Include Remote) while holding experience bounds
    if (matches.length === 0) {
      matches = allProfiles.filter(p => filterFn(p, 1));
      if (matches.length > 0) {
        notice = "Relaxed location filter to surface matching profiles within the experience criteria.";
      }
    }

    // Stage 3: Fallback 2 - Relax company types while holding experience bounds
    if (matches.length === 0) {
      matches = allProfiles.filter(p => filterFn(p, 2));
      if (matches.length > 0) {
        notice = "Broadened company type criteria to present role-aligned candidates within requested experience range.";
      }
    }

    // =========================================================================
    // 3. Batched Scoring of Top Matches
    // =========================================================================
    const batchToScore = matches.slice(0, 10);
    let evalMap = new Map();

    if (batchToScore.length > 0 && rubric.length > 0) {
      try {
        const scorePayload = await callLLM(RUBRIC_SCORING_SYSTEM_PROMPT, buildScorePrompt(rubric, batchToScore));
        (scorePayload.evaluations || []).forEach(ev => {
          if (ev.candidate_id) evalMap.set(ev.candidate_id, ev);
        });
      } catch (err) {
        console.warn("LLM Scoring failed, using fallback heuristic:", err.message);
      }
    }

    const scoredMatches = batchToScore.map(p => {
      const evalData = evalMap.get(p.id);
      return {
        ...p,
        score: evalData?.score ?? 75,
        fit_status: evalData?.fit_status ?? 'strong_match',
        explanation: evalData?.explanation ||
          `${p.name} has ${p.years_experience} years of experience with ${p.skills?.slice(0, 3).join(', ')} at ${p.current_company}.`
      };
    }).sort((a, b) => b.score - a.score);

    // =========================================================================
    // 4. Shortlist Management & Result Composition
    // =========================================================================
    // Shortlisted candidates are preserved ONLY if they meet the updated hard criteria
    const validShortlist = allProfiles
      .filter(p => shortlistedIds.includes(p.id) && filterFn(p, 2))
      .map(p => {
        const evalData = evalMap.get(p.id);
        const prevContext = candidatesContext.find(c => c.id === p.id);
        return {
          ...p,
          score: evalData?.score ?? prevContext?.score ?? 90,
          explanation: prevContext?.explanation || `${p.name} was previously shortlisted by the recruiter.`,
          isShortlisted: true
        };
      });

    const shortlistedIdsSet = new Set(validShortlist.map(s => s.id));
    const freshCandidates = scoredMatches.filter(p => !shortlistedIdsSet.has(p.id));
    const finalResults = [...validShortlist, ...freshCandidates].slice(0, 5);

    return NextResponse.json({
      filters,
      rubric,
      changelog,
      notice,
      profiles: finalResults,
      total_matches: matches.length
    });

  } catch (error) {
    console.error("API error in sourcing pipeline:", error);

    let userMessage = error?.message || "Failed to process candidate search session.";
    const errString = `${error?.name || ''} ${error?.message || ''} ${error?.status || ''}`.toLowerCase();

    if (error?.status === 401 || errString.includes('401') || errString.includes('invalid_api_key') || errString.includes('invalid api key')) {
      userMessage = "Invalid Groq API Key. Please verify and update your API key in 'API Settings' at the top of the page.";
    } else if (error?.status === 404 || errString.includes('model_not_found') || errString.includes('does not exist')) {
      userMessage = "Selected Groq model was not found or is unavailable. Please check the model ID in 'API Settings' (e.g., 'llama-3.3-70b-versatile').";
    } else if (error?.status === 429 || errString.includes('rate_limit') || errString.includes('rate limit') || errString.includes('tokens per minute')) {
      userMessage = "Groq API rate limit or quota exceeded. Please wait a moment before refining or search with another model.";
    } else if (errString.includes('econnrefused') || errString.includes('enotfound') || errString.includes('fetch failed')) {
      userMessage = "Network connection to Groq API failed. Please check your internet connection.";
    } else if (errString.includes('api key is not configured')) {
      userMessage = "Groq API Key is not configured. Please open 'API Settings' in the top bar and enter your API key.";
    }

    return NextResponse.json(
      { error: userMessage },
      { status: error?.status || 500 }
    );
  }
}