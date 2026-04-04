import { readFileSync } from "fs";
import { join } from "path";

interface CommitEntry {
  hash: string;
  date: string;
  message: string;
}

function getChangelog(): CommitEntry[] {
  try {
    const raw = readFileSync(
      join(process.cwd(), "public", "changelog.json"),
      "utf-8"
    );
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export default function ChangelogPage() {
  const commits = getChangelog();

  const grouped = commits.reduce<Record<string, CommitEntry[]>>(
    (acc, commit) => {
      if (!acc[commit.date]) acc[commit.date] = [];
      acc[commit.date].push(commit);
      return acc;
    },
    {}
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Changelog</h1>
      {Object.keys(grouped).length === 0 && (
        <p className="text-sm text-muted-foreground">
          No changelog entries found. Run <code>npm run changelog</code> to
          generate.
        </p>
      )}
      <div className="space-y-6">
        {Object.entries(grouped).map(([date, entries]) => (
          <div key={date}>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">
              {date}
            </h2>
            <ul className="space-y-1 border rounded-md p-3">
              {entries.map((entry) => (
                <li key={entry.hash} className="flex items-start gap-2 text-sm">
                  <code className="text-xs text-muted-foreground shrink-0 mt-0.5">
                    {entry.hash}
                  </code>
                  <span>{entry.message}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
