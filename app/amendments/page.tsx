"use client";

import { useEffect, useState, useCallback } from "react";

interface AmendmentData {
  id: number;
  number: number;
  title: string;
  description: string;
  proposedByUserId: number;
  proposerName: string;
  status: "voting" | "approved" | "rejected" | "deferred";
  effectiveDate: string | null;
  season: number;
  votingOpensAt: string;
  votingClosesAt: string | null;
  rejectionCommentary: string | null;
  votes: { userId: number; vote: "yee" | "nah" }[];
}

interface UserData {
  id: number;
  name: string;
  color: string;
}

export default function AmendmentsPage() {
  const [amendments, setAmendments] = useState<AmendmentData[]>([]);
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [showPropose, setShowPropose] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    setLoading(true);
    fetch("/api/amendments")
      .then((r) => r.json())
      .then((d) => {
        setAmendments(d.amendments || []);
        setAllUsers(d.users || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setCurrentUserId(d.user.id);
      })
      .catch(() => {});
  }, [loadData]);

  async function handleVote(amendmentId: number, vote: "yee" | "nah") {
    await fetch(`/api/amendments/${amendmentId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote }),
    });
    loadData();
  }

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !description) return;
    await fetch("/api/amendments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    setTitle("");
    setDescription("");
    setShowPropose(false);
    loadData();
  }

  const voting = amendments.filter((a) => a.status === "voting");
  const resolved = amendments.filter((a) => a.status !== "voting");

  function voteCell(amendment: AmendmentData, user: UserData) {
    const v = amendment.votes.find((vote) => vote.userId === user.id);
    if (!v) return <span className="text-muted-foreground">--</span>;
    if (v.vote === "yee") return <span className="text-green-600 dark:text-green-400 font-bold">Yee</span>;
    return <span className="text-red-500 font-bold">Nah</span>;
  }

  function tallyStr(amendment: AmendmentData) {
    const y = amendment.votes.filter((v) => v.vote === "yee").length;
    const n = amendment.votes.filter((v) => v.vote === "nah").length;
    return `${y}-${n}`;
  }

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">Loading...</div>
    );
  }

  return (
    <div className="px-4 py-4 max-w-full">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold">Amendments</h1>
        <button
          onClick={() => setShowPropose(!showPropose)}
          className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 border border-primary"
        >
          + Propose
        </button>
      </div>

      {/* Propose Form */}
      {showPropose && (
        <form
          onSubmit={handlePropose}
          className="mb-4 border border-amber-400/40 bg-amber-50/30 dark:bg-amber-950/10 p-3 space-y-2"
        >
          <p className="text-xs font-semibold">New Amendment Proposal</p>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Amendment title"
            className="w-full border border-input bg-background px-2 py-1 text-xs"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the proposed rule change..."
            rows={2}
            className="w-full border border-input bg-background px-2 py-1 text-xs"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 border border-primary"
            >
              Submit
            </button>
            <button
              type="button"
              onClick={() => setShowPropose(false)}
              className="px-3 py-1 text-xs font-medium border border-input hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Active Votes - keep interactive cards for these since you need to vote */}
      {voting.length > 0 && (
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-sm font-semibold">Active Votes</h2>
          </div>
          <div className="border border-amber-400/40">
            {voting.map((a, idx) => {
              const hasVoted = currentUserId && a.votes.some((v) => v.userId === currentUserId);
              const yeeCount = a.votes.filter((v) => v.vote === "yee").length;
              return (
                <div
                  key={a.id}
                  className={`p-3 bg-amber-50/30 dark:bg-amber-950/10 ${idx > 0 ? "border-t border-amber-400/40" : ""}`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-1.5 py-0.5">
                      #{a.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                    </div>
                  </div>
                  {/* Inline vote table */}
                  <table className="w-full text-xs border-collapse mb-2">
                    <thead>
                      <tr className="bg-muted/50">
                        {allUsers.map((u) => (
                          <th key={u.id} className="border border-border px-2 py-1 text-center font-semibold">
                            <span className="inline-flex items-center gap-1">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: u.color }}
                              />
                              {u.name}
                            </span>
                          </th>
                        ))}
                        <th className="border border-border px-2 py-1 text-center font-semibold">Tally</th>
                        <th className="border border-border px-2 py-1 text-center font-semibold">{yeeCount}/3</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-background">
                        {allUsers.map((u) => (
                          <td key={u.id} className="border border-border px-2 py-1 text-center">
                            {voteCell(a, u)}
                          </td>
                        ))}
                        <td className="border border-border px-2 py-1 text-center font-semibold">
                          {tallyStr(a)}
                        </td>
                        <td className="border border-border px-2 py-1">
                          <div className="h-2 bg-muted rounded-sm overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-sm"
                              style={{ width: `${(yeeCount / 3) * 100}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {currentUserId && !hasVoted && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVote(a.id, "yee")}
                        className="px-3 py-1 text-xs font-bold bg-green-600 text-white hover:bg-green-700 border border-green-700"
                      >
                        Yee
                      </button>
                      <button
                        onClick={() => handleVote(a.id, "nah")}
                        className="px-3 py-1 text-xs font-bold bg-red-600 text-white hover:bg-red-700 border border-red-700"
                      >
                        Nah
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Approved & Rejected - full spreadsheet table */}
      <section className="mb-4">
        <h2 className="text-sm font-semibold mb-2">All Amendments</h2>
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/70">
                <th className="border border-border px-2 py-1.5 text-left font-semibold w-8">#</th>
                <th className="border border-border px-2 py-1.5 text-left font-semibold">Title</th>
                <th className="border border-border px-2 py-1.5 text-left font-semibold">Status</th>
                {allUsers.map((u) => (
                  <th key={u.id} className="border border-border px-2 py-1.5 text-center font-semibold">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: u.color }}
                      title={u.name}
                    />
                    <span className="ml-1">{u.name[0]}</span>
                  </th>
                ))}
                <th className="border border-border px-2 py-1.5 text-center font-semibold">Tally</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const sorted = resolved.sort((a, b) => a.number - b.number);
                let lastSeason: number | null = null;
                const colCount = 5 + allUsers.length; // #, Title, Status, [users], Tally
                return sorted.map((a, i) => {
                  const rows: React.ReactNode[] = [];
                  if (a.season !== lastSeason) {
                    rows.push(
                      <tr key={`season-${a.season}`} className="bg-amber-100/60 dark:bg-amber-900/20">
                        <td
                          colSpan={colCount}
                          className="border border-border px-2 py-1.5 font-bold text-xs tracking-wide"
                        >
                          {a.season} Season
                        </td>
                      </tr>
                    );
                    lastSeason = a.season;
                  }
                  rows.push(
                    <tr
                      key={a.id}
                      className={`hover:bg-amber-50 dark:hover:bg-amber-950/20 ${
                        a.status === "rejected"
                          ? "bg-red-50/30 dark:bg-red-950/10"
                          : a.status === "deferred"
                            ? "bg-blue-50/30 dark:bg-blue-950/10"
                            : i % 2 === 0
                              ? "bg-background"
                              : "bg-muted/30"
                      }`}
                      title={a.description + (a.rejectionCommentary ? ` — ${a.rejectionCommentary}` : "")}
                    >
                      <td className="border border-border px-2 py-1 tabular-nums">{a.number}</td>
                      <td className="border border-border px-2 py-1 max-w-[300px]">
                        <span className="truncate block">{a.title}</span>
                        {a.rejectionCommentary && (
                          <span className="text-red-500 font-bold block">{a.rejectionCommentary}</span>
                        )}
                      </td>
                      <td className="border border-border px-2 py-1 whitespace-nowrap">
                        {a.status === "approved" ? (
                          <span className="text-green-600 dark:text-green-400 font-semibold">Approved</span>
                        ) : a.status === "deferred" ? (
                          <span className="text-blue-500 dark:text-blue-400 font-semibold">Deferred</span>
                        ) : (
                          <span className="text-red-500 font-semibold">Rejected</span>
                        )}
                      </td>
                      {allUsers.map((u) => (
                        <td key={u.id} className="border border-border px-2 py-1 text-center">
                          {voteCell(a, u)}
                        </td>
                      ))}
                      <td className="border border-border px-2 py-1 text-center font-semibold tabular-nums">
                        {tallyStr(a)}
                      </td>
                    </tr>
                  );
                  return rows;
                });
              })()}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
