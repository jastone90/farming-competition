import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { join } from "path";

interface CommitEntry {
  hash: string;
  date: string;
  message: string;
}

const output = execSync(
  'git log --pretty=format:"%H||%ad||%s" --date=short',
  { encoding: "utf-8" }
);

const commits: CommitEntry[] = output
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [hash, date, message] = line.split("||");
    return { hash: hash.slice(0, 7), date, message };
  });

const outPath = join(process.cwd(), "public", "changelog.json");
writeFileSync(outPath, JSON.stringify(commits, null, 2));
console.log(`Wrote ${commits.length} commits to public/changelog.json`);
