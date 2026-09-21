'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  SearchOutlined,
  LockOutlined,
  UnlockOutlined,
  ReloadOutlined,
  SendOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  CloseOutlined,
  LikeOutlined,
  DislikeOutlined,
  ClockCircleOutlined,
  RollbackOutlined,
  FilterOutlined,
  EnvironmentOutlined,
  SolutionOutlined,
  BankOutlined,
  SlidersOutlined,
  RightOutlined,
  ThunderboltOutlined,
  KeyOutlined, SettingOutlined 
} from '@ant-design/icons';
import { Modal, Input, Select, message, App } from "antd";

function RecruiterApp() {
  const { message: toast } = App.useApp();
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [frozen, setFrozen] = useState(false);

  const [filters, setFilters] = useState(null);
  const [rubric, setRubric] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [changelog, setChangelog] = useState('');

  const [shortlistedIds, setShortlistedIds] = useState([]);
  const [rejectedIds, setRejectedIds] = useState([]);
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiModel, setApiModel] = useState("");

  const [history, setHistory] = useState([]);
  const historyEndRef = useRef(null);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [history]);

  useEffect(() => {
    setShowApiModal(true);

    const handleWindowError = (event) => {
      const msg = event?.error?.message || event?.message || "An unexpected browser runtime error occurred.";
      console.error("Runtime error caught:", event);
      toast.error(msg);
      setError(msg);
    };

    const handleUnhandledRejection = (event) => {
      const reason = event?.reason;
      const msg = reason?.message || (typeof reason === 'string' ? reason : "Unhandled asynchronous runtime error.");
      console.error("Unhandled promise rejection caught:", reason);
      toast.error(msg);
      setError(msg);
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [toast]);

  const saveApiConfig = async () => {
    try {
      const response = await fetch("/api/refine-loop/api-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey,
          apiModel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data.error || "Failed to save API configuration";
        setError(errMsg);
        toast.error(errMsg);
        return;
      }

      toast.success("API configuration saved successfully");
      setShowApiModal(false);
    } catch (err) {
      const msg = err.message || "Failed to connect to configuration service.";
      setError(msg);
      toast.error(msg);
    }
  };

  const addToHistory = useCallback(
    (action, promptText, changelogText) => {
      const labels = {
        search: 'Search',
        refine: 'Refined',
        filter_edit: 'Filter',
      };

      const now = new Date();

      setHistory((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 7)}`,
          action,
          label: labels[action] || 'Action',
          text: promptText,
          changelog: changelogText || null,
          time: now.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    },
    []
  );

  const runPipeline = async (
    action,
    customFeedback = null,
    overrideFilters = null,
    extraShortlisted = null,
    extraRejected = null,
    historyAction = null
  ) => {
    setLoading(true);
    setError(null);

    const activeShortlisted =
      extraShortlisted ?? shortlistedIds;

    const activeRejected =
      extraRejected ?? rejectedIds;

    const effectivePromptText =
      customFeedback || feedback || query;

    try {
      const response = await fetch('/api/refine-loop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          query: effectivePromptText,
          feedback: customFeedback || feedback,
          currentFilters:
            overrideFilters || filters,
          currentRubric: rubric,
          candidatesContext: profiles,
          shortlistedIds: activeShortlisted,
          rejectedIds: activeRejected,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Failed to process candidate search.'
        );
      }

      setFilters(data.filters);
      setRubric(data.rubric || []);
      setProfiles(data.profiles || []);
      setChangelog(data.changelog || '');
      setNotice(data.notice || null);
      setFeedback('');

      addToHistory(
        historyAction || action,
        effectivePromptText,
        data.changelog
      );
    } catch (err) {
      console.error(err);

      const errorMsg =
        err.message ||
        'An unexpected error occurred while communicating with the recruitment pipeline.';

      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = (candidate, idx) => {
    const updated = [
      ...new Set([
        ...shortlistedIds,
        candidate.id,
      ]),
    ];

    setShortlistedIds(updated);

    runPipeline(
      'refine',
      `Candidate #${idx + 1} (${candidate.name}) is a strong match — prioritize candidates with similar skills and company background.`,
      null,
      updated,
      rejectedIds
    );
  };

  const handleReject = (candidate, idx) => {
    const updated = [
      ...new Set([
        ...rejectedIds,
        candidate.id,
      ]),
    ];

    setRejectedIds(updated);

    runPipeline(
      'refine',
      `Candidate #${idx + 1} (${candidate.name}) is not a good fit — find better alternatives without these shortcomings.`,
      null,
      shortlistedIds,
      updated
    );
  };

  const removeFilterTag = (type, value) => {
    if (!filters) return;

    const updatedFilters = {
      ...filters,
      [type]: (filters[type] || []).filter(
        (item) => item !== value
      ),
    };

    if (type === 'skills') {
      updatedFilters.required_skills =
        updatedFilters.required_skills?.filter(
          (s) => s !== value
        );

      updatedFilters.optional_skills =
        updatedFilters.optional_skills?.filter(
          (s) => s !== value
        );
    }

    setFilters(updatedFilters);

    runPipeline(
      'refine',
      `Removed "${value}" from ${type}. Do not require or prioritize "${value}" in ${type}.`,
      updatedFilters,
      null,
      null,
      'filter_edit'
    );
  };

  const handleReset = () => {
    setQuery('');
    setFeedback('');
    setFilters(null);
    setRubric([]);
    setProfiles([]);
    setChangelog('');
    setNotice(null);
    setError(null);
    setShortlistedIds([]);
    setRejectedIds([]);
    setFrozen(false);
    setHistory([]);
  };

  const FilterPill = ({
    children,
    removable,
    onRemove,
    variant = 'default',
  }) => {
    const variants = {
      default:
        'bg-white text-slate-700 border-slate-200',
      purple:
        'bg-violet-50 text-violet-700 border-violet-100',
      blue:
        'bg-blue-50 text-blue-700 border-blue-100',
      green:
        'bg-emerald-50 text-emerald-700 border-emerald-100',
    };

    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium ${variants[variant]}`}
      >
        {children}

        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full p-0.5 transition hover:bg-black/5"
            aria-label={`Remove ${children}`}
          >
            <CloseOutlined className="text-[12px]" />
          </button>
        )}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-sans text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold tracking-tight text-white">
              AI
            </div>

            <div>
              <div className="text-[16px] font-semibold tracking-[-0.01em] text-slate-950">
                Flexiple AI Recruiter
              </div>

              <div className="mt-0.5 text-[13px] text-slate-500">
                Intelligent candidate sourcing
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowApiModal(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
          >
            <SettingOutlined />
            API Settings
          </button>
          <div className="flex items-center gap-2.5">
            {profiles.length > 0 && (
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <RollbackOutlined className="text-[15px]" />
                New search
              </button>
            )}

            {profiles.length > 0 && !frozen && (
              <button
                type="button"
                onClick={() => setFrozen(true)}
                className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800"
              >
                <LockOutlined className="text-[15px]" />
                Freeze search
              </button>
            )}

            {frozen && (
              <button
                type="button"
                onClick={() => setFrozen(false)}
                className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <UnlockOutlined className="text-[15px]" />
                Unfreeze search
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="mx-auto grid max-w-[1440px] grid-cols-1 gap-7 px-6 py-7 lg:grid-cols-[400px_minmax(0,1fr)] lg:px-8">
        {/* LEFT SIDEBAR */}
        <aside className="space-y-5 lg:sticky lg:top-[92px] lg:self-start">
          {/* SEARCH / REFINE */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50">
                  <ThunderboltOutlined className="text-[16px] text-violet-600" />
                </div>

                <div>
                  <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
                    {filters
                      ? 'Refine your search'
                      : 'Find candidates'}
                  </h2>

                  <p className="mt-0.5 text-[13px] text-slate-500">
                    {filters
                      ? 'Tell the recruiter what to change'
                      : 'Describe the talent you need'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {!filters ? (
                <>
                  <textarea
                    value={query}
                    onChange={(e) =>
                      setQuery(e.target.value)
                    }
                    placeholder="e.g. Senior React developers with 4–7 years of experience, startup background, based in Bangalore..."
                    className="h-36 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-[15px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-50"
                  />

                  <button
                    type="button"
                    disabled={
                      loading || !query.trim()
                    }
                    onClick={() =>
                      runPipeline('search')
                    }
                    className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-[14px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? (
                      <ReloadOutlined className="animate-spin text-[15px]" />
                    ) : (
                      <SearchOutlined className="text-[15px]" />
                    )}

                    Find matching candidates

                    <RightOutlined className="text-[12px]" />
                  </button>
                </>
              ) : frozen ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex gap-3">
                    <CheckCircleOutlined className="mt-0.5 shrink-0 text-[18px] text-emerald-600" />

                    <div>
                      <p className="text-[14px] font-semibold text-emerald-800">
                        Search frozen
                      </p>

                      <p className="mt-1.5 text-[13px] leading-5 text-emerald-700">
                        The current candidate set is
                        locked. Unfreeze the search to
                        continue refining.
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          setFrozen(false)
                        }
                        className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700 hover:text-emerald-900"
                      >
                        <UnlockOutlined className="text-[13px]" />
                        Continue refining
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      value={feedback}
                      onChange={(e) =>
                        setFeedback(e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (
                          e.key === 'Enter' &&
                          feedback.trim()
                        ) {
                          runPipeline('refine');
                        }
                      }}
                      placeholder="Prioritize candidate #2..."
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-50"
                    />

                    <button
                      type="button"
                      disabled={
                        loading || !feedback.trim()
                      }
                      onClick={() =>
                        runPipeline('refine')
                      }
                      className="flex w-12 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-40"
                    >
                      {loading ? (
                        <ReloadOutlined className="animate-spin text-[15px]" />
                      ) : (
                        <SendOutlined className="text-[15px]" />
                      )}
                    </button>
                  </div>

                  <p className="mt-3 text-[12px] leading-5 text-slate-400">
                    You can also use the Match / Not a fit
                    actions on candidates.
                  </p>
                </>
              )}
            </div>
          </section>

          {/* FILTERS */}
          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                  <SlidersOutlined className="text-[16px] text-blue-600" />
                </div>

                <div>
                  <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
                    Search criteria
                  </h2>

                  <p className="mt-0.5 text-[13px] text-slate-500">
                    AI-generated requirements
                  </p>
                </div>
              </div>

              {changelog && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  Updated
                </span>
              )}
            </div>

            <div className="p-6">
              {!filters ? (
                <div className="py-8 text-center">
                  <FilterOutlined className="text-[24px] text-slate-300" />

                  <p className="mt-3 text-[13px] text-slate-400">
                    Search criteria will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {changelog && (
                    <div className="rounded-xl bg-slate-50 px-4 py-3.5 text-[13px] leading-5 text-slate-600">
                      <span className="font-semibold text-slate-800">
                        Latest change
                      </span>

                      <div className="mt-1.5">
                        {changelog}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Requirements
                      </span>

                      {!frozen && (
                        <span className="text-[11px] text-slate-400">
                          Click × to remove
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {filters.role_focus && (
                        <FilterPill variant="purple">
                          <ThunderboltOutlined className="text-[13px]" />
                          {filters.role_focus}
                        </FilterPill>
                      )}

                      <FilterPill variant="blue">
                        <SolutionOutlined className="text-[13px]" />
                        {filters.min_exp || 0}+ yrs
                      </FilterPill>

                      {filters.skills?.map((skill) => (
                        <FilterPill
                          key={skill}
                          removable={!frozen}
                          onRemove={() =>
                            removeFilterTag(
                              'skills',
                              skill
                            )
                          }
                        >
                          {skill}
                        </FilterPill>
                      ))}

                      {filters.locations?.map(
                        (location) => (
                          <FilterPill
                            key={location}
                            removable={!frozen}
                            onRemove={() =>
                              removeFilterTag(
                                'locations',
                                location
                              )
                            }
                          >
                            <EnvironmentOutlined className="text-[13px]" />
                            {location}
                          </FilterPill>
                        )
                      )}

                      {filters.company_types?.map(
                        (company) => (
                          <FilterPill
                            key={company}
                            removable={!frozen}
                            onRemove={() =>
                              removeFilterTag(
                                'company_types',
                                company
                              )
                            }
                          >
                            <BankOutlined className="text-[13px]" />
                            {company}
                          </FilterPill>
                        )
                      )}
                    </div>
                  </div>

                  {rubric?.length > 0 && (
                    <div>
                      <span className="mb-3 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Fit signals
                      </span>

                      <div className="space-y-2">
                        {rubric.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3"
                          >
                            <span className="text-[13px] font-medium text-slate-700">
                              {item.title ||
                                item.criterion}
                            </span>

                            <span
                              className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${
                                item.weight ===
                                'high'
                                  ? 'bg-rose-50 text-rose-600'
                                  : 'bg-amber-50 text-amber-600'
                              }`}
                            >
                              {item.weight}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* HISTORY */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <ClockCircleOutlined className="text-[16px] text-slate-400" />

                <span className="text-[14px] font-semibold">
                  Activity
                </span>
              </div>

              <span className="text-[12px] text-slate-400">
                {history.length} actions
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto p-5">
              {history.length === 0 ? (
                <div className="py-6 text-center text-[13px] text-slate-400">
                  Your search activity will appear
                  here.
                </div>
              ) : (
                <div className="space-y-5">
                  {history.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="relative flex gap-3"
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-violet-600">
                            {entry.label}
                          </span>

                          <span className="text-[11px] text-slate-400">
                            {entry.time}
                          </span>
                        </div>

                        <p className="mt-1.5 text-[13px] leading-5 text-slate-700">
                          {entry.text}
                        </p>

                        {entry.changelog && (
                          <p className="mt-1.5 text-[12px] leading-5 text-slate-400">
                            {entry.changelog}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  <div ref={historyEndRef} />
                </div>
              )}
            </div>
          </section>
        </aside>

        {/* RIGHT CONTENT */}
        <section className="min-w-0">
          {/* ERROR */}
          {error && (
            <div className="mb-5 flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <div className="flex gap-3">
                <ExclamationCircleOutlined className="mt-0.5 shrink-0 text-[18px] text-rose-500" />
                <div>
                  <p className="text-[14px] font-semibold text-rose-800">
                    Search Error
                  </p>
                  <p className="mt-1.5 text-[13px] leading-5 text-rose-700">
                    {error}
                  </p>
                  {(error.toLowerCase().includes('api key') || error.toLowerCase().includes('model') || error.toLowerCase().includes('settings')) && (
                    <button
                      type="button"
                      onClick={() => setShowApiModal(true)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-rose-700"
                    >
                      <KeyOutlined className="text-[13px]" />
                      Open API Settings
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="rounded-lg p-1 text-rose-400 transition hover:bg-rose-100 hover:text-rose-600"
                aria-label="Dismiss error"
              >
                <CloseOutlined className="text-[12px]" />
              </button>
            </div>
          )}

          {/* LOADING */}
          {loading && (
            <div className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50">
                <ReloadOutlined className="animate-spin text-[24px] text-violet-600" />
              </div>

              <h3 className="mt-5 text-[16px] font-semibold text-slate-800">
                Finding the right candidates
              </h3>

              <p className="mt-2 max-w-sm text-center text-[13px] leading-5 text-slate-400">
                Evaluating profiles against your
                requirements and fit criteria...
              </p>
            </div>
          )}

          {/* EMPTY */}
          {!loading && profiles.length === 0 && (
            <div className="flex min-h-[650px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <SearchOutlined className="text-[28px] text-slate-400" />
              </div>

              <h2 className="mt-6 text-[18px] font-semibold tracking-[-0.01em] text-slate-800">
                Your candidates will appear here
              </h2>

              <p className="mt-2.5 max-w-md text-[14px] leading-6 text-slate-400">
                Describe the kind of person you are
                looking for. The AI recruiter will turn
                your requirement into search criteria and
                rank matching profiles.
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[12px] text-slate-400">
                <ThunderboltOutlined className="text-[14px] text-violet-500" />
                Natural language search
                <span className="text-slate-300">•</span>
                AI refinement
                <span className="text-slate-300">•</span>
                Candidate feedback
              </div>
            </div>
          )}

          {/* RESULTS */}
          {!loading && profiles.length > 0 && (
            <>
              {/* RESULT HEADER */}
              <div className="mb-6 flex items-end justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-[21px] font-semibold tracking-[-0.025em] text-slate-950">
                      {frozen
                        ? 'Final candidates'
                        : 'Candidate matches'}
                    </h1>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-500">
                      {profiles.length}
                    </span>
                  </div>

                  <p className="mt-1.5 text-[14px] text-slate-500">
                    Ranked against your current search
                    criteria
                  </p>
                </div>

                {frozen && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-[12px] font-semibold text-emerald-700">
                    <LockOutlined className="text-[13px]" />
                    Search locked
                  </div>
                )}
              </div>

              {/* NOTICE */}
              {notice && (
                <div className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
                  <WarningOutlined className="mt-0.5 shrink-0 text-[18px] text-amber-600" />

                  <div>
                    <p className="text-[13px] font-semibold text-amber-900">
                      Search notice
                    </p>

                    <p className="mt-1 text-[13px] leading-5 text-amber-800">
                      {notice}
                    </p>
                  </div>
                </div>
              )}

              {/* CANDIDATES */}
              <div className="space-y-4">
                {profiles.map((candidate, index) => {
                  const isShortlisted =
                    shortlistedIds.includes(
                      candidate.id
                    );

                  const isRejected =
                    rejectedIds.includes(
                      candidate.id
                    );

                  return (
                    <article
                      key={candidate.id}
                      className={`group rounded-2xl border bg-white p-6 transition ${
                        isShortlisted
                          ? 'border-emerald-300 ring-2 ring-emerald-50'
                          : isRejected
                          ? 'border-slate-200 opacity-55'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* TOP */}
                      <div className="flex gap-4">
                        {/* AVATAR */}
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[15px] font-bold text-slate-600">
                          {candidate.name
                            ?.split(' ')
                            .slice(0, 2)
                            .map((n) => n[0])
                            .join('')}
                        </div>

                        {/* INFO */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2.5">
                                <span className="text-[18px] font-semibold tracking-[-0.015em] text-slate-950">
                                  {candidate.name}
                                </span>

                                <span className="text-[12px] font-medium text-slate-400">
                                  #{index + 1}
                                </span>

                                {isShortlisted && (
                                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                                    <CheckCircleOutlined className="text-[11px]" />
                                    Shortlisted
                                  </span>
                                )}

                                {isRejected && (
                                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600">
                                    Not a fit
                                  </span>
                                )}
                              </div>

                              <p className="mt-1.5 text-[14px] text-slate-600">
                                {candidate.current_title}

                                <span className="mx-2 text-slate-300">
                                  @
                                </span>

                                <span className="font-semibold text-slate-800">
                                  {
                                    candidate.current_company
                                  }
                                </span>
                              </p>
                            </div>

                            {!isShortlisted &&
                              !isRejected && (
                                <div className="shrink-0 text-right">
                                  <div
                                    className={`text-[22px] font-bold tracking-[-0.03em] ${
                                      candidate.score >=
                                      50
                                        ? 'text-violet-600'
                                        : 'text-amber-600'
                                    }`}
                                  >
                                    {candidate.score}%
                                  </div>

                                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                    match
                                  </div>
                                </div>
                              )}
                          </div>

                          {/* META */}
                          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-slate-500">
                            <span className="flex items-center gap-1.5">
                              <EnvironmentOutlined className="text-[13px]" />
                              {candidate.location}
                            </span>

                            <span className="flex items-center gap-1.5">
                              <SolutionOutlined className="text-[13px]" />
                              {
                                candidate.years_experience
                              }{' '}
                              yrs experience
                            </span>

                            {candidate.current_company_type && (
                              <span className="flex items-center gap-1.5">
                                <BankOutlined className="text-[13px]" />
                                {
                                  candidate.current_company_type
                                }
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* MATCH EXPLANATION */}
                      {!isRejected &&
                        candidate.explanation && (
                          <div className="mt-5 rounded-xl bg-violet-50/60 px-4 py-4">
                            <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-violet-600">
                              <ThunderboltOutlined className="text-[13px]" />
                              Why this candidate matches
                            </div>

                            <p className="text-[14px] leading-6 text-slate-700">
                              {candidate.explanation}
                            </p>
                          </div>
                        )}

                      {/* SKILLS */}
                      {!isRejected &&
                        candidate.skills?.length >
                          0 && (
                          <div className="mt-5 flex flex-wrap gap-2">
                            {candidate.skills
                              .slice(0, 7)
                              .map(
                                (
                                  skill,
                                  skillIndex
                                ) => (
                                  <span
                                    key={
                                      skillIndex
                                    }
                                    className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[12px] font-medium text-slate-600"
                                  >
                                    {skill}
                                  </span>
                                )
                              )}

                            {candidate.skills.length >
                              7 && (
                              <span className="px-1.5 py-1.5 text-[12px] text-slate-400">
                                +
                                {candidate.skills
                                  .length - 7}{' '}
                                more
                              </span>
                            )}
                          </div>
                        )}

                      {/* ACTIONS */}
                      {!frozen &&
                        !isShortlisted &&
                        !isRejected && (
                          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                            <span className="text-[12px] text-slate-400">
                              Help improve the next
                              results
                            </span>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleReject(
                                    candidate,
                                    index
                                  )
                                }
                                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-[12px] font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                              >
                                <DislikeOutlined className="text-[13px]" />
                                Not a fit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleAccept(
                                    candidate,
                                    index
                                  )
                                }
                                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-emerald-700"
                              >
                                <LikeOutlined className="text-[13px]" />
                                Strong match
                              </button>
                            </div>
                          </div>
                        )}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </main>
      <Modal
        title="API Credentials"
        open={showApiModal}
        onCancel={() => setShowApiModal(false)}
        footer={null}
        centered
      >
        <div className="space-y-5 pt-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              API Key
            </label>

            <Input.Password
              prefix={<KeyOutlined />}
              placeholder="Enter your API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Model
            </label>

            <Input
              className="w-full"
              value={apiModel}
              onChange={(e) => setApiModel(e.target.value)}
              placeholder="Enter your api model ex. openai/gpt-oss-20b"
            />
          </div>

          <button
            onClick={saveApiConfig}
            disabled={!apiKey.trim()}
            className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save Settings
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default function Home() {
  return (
    <App>
      <RecruiterApp />
    </App>
  );
}