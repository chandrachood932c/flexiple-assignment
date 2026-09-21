export function buildSearchPrompt(query) {
  return JSON.stringify({ recruiter_query: query }, null, 2);
}

export function buildRefinePrompt(currentFilters, currentRubric, feedback, candidateBatch) {
  return JSON.stringify({
    current_filters: currentFilters,
    current_rubric: currentRubric,
    recruiter_feedback: feedback,
    current_batch: (candidateBatch || []).map(c => ({
      id: c.id,
      name: c.name,
      current_title: c.current_title,
      years_experience: c.years_experience,
      company: c.current_company,
      company_type: c.current_company_type,
      location: c.location
    }))
  }, null, 2);
}

export function buildScorePrompt(rubric, candidates) {
  return JSON.stringify({
    rubric,
    candidates: candidates.map(c => ({
      id: c.id,
      name: c.name,
      current_title: c.current_title,
      years_experience: c.years_experience,
      location: c.location,
      company: c.current_company,
      company_type: c.current_company_type,
      skills: c.skills,
      summary: c.summary
    }))
  }, null, 2);
}