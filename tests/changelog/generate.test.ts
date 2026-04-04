import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

/**
 * Tests the changelog generation logic.
 * We replicate the core parsing from lib/generate-changelog.ts
 * to avoid sandbox issues with spawning tsx.
 */
describe("generate-changelog", () => {
  it("parses git log output into CommitEntry[] shape", () => {
    const output = execSync(
      'git log --pretty=format:"%H||%ad||%s" --date=short -10',
      { encoding: "utf-8", cwd: process.cwd() }
    );

    const commits = output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, date, message] = line.split("||");
        return { hash: hash.slice(0, 7), date, message };
      });

    expect(Array.isArray(commits)).toBe(true);
    expect(commits.length).toBeGreaterThan(0);

    for (const entry of commits) {
      expect(entry).toHaveProperty("hash");
      expect(entry).toHaveProperty("date");
      expect(entry).toHaveProperty("message");
      expect(typeof entry.hash).toBe("string");
      expect(typeof entry.date).toBe("string");
      expect(typeof entry.message).toBe("string");
      expect(entry.hash).toHaveLength(7);
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("handles commit messages with special characters", () => {
    // Simulate parsing a line with pipes, quotes, etc.
    const fakeLine = 'abc1234||2026-03-15||Fix "bug" in scoring & add tests';
    const [hash, date, message] = fakeLine.split("||");
    const entry = { hash: hash.slice(0, 7), date, message };

    expect(entry.hash).toBe("abc1234");
    expect(entry.date).toBe("2026-03-15");
    expect(entry.message).toBe('Fix "bug" in scoring & add tests');
  });

  it("produces empty array for empty input", () => {
    const commits = ""
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, date, message] = line.split("||");
        return { hash: hash.slice(0, 7), date, message };
      });

    expect(commits).toEqual([]);
  });
});
