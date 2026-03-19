#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const files = [
  "src/core/clients/ClientDetailPage.tsx",
  "src/core/apartments/ApartmentDetailPage.tsx",
];

const maxUseStatePerFile = 45;
const forbiddenAsyncStatePattern = /\[(loading|error|isLoading|setLoading|setError)\s*,/;

for (const relativeFile of files) {
  const filePath = path.resolve(process.cwd(), relativeFile);
  const source = fs.readFileSync(filePath, "utf8");
  const useStateCount = [...source.matchAll(/useState\(/g)].length;
  if (useStateCount > maxUseStatePerFile) {
    throw new Error(`[architecture] ${relativeFile} has ${useStateCount} useState hooks (max ${maxUseStatePerFile}).`);
  }
  if (forbiddenAsyncStatePattern.test(source)) {
    throw new Error(
      `[architecture] ${relativeFile} defines local async loading/error state. Use shared hooks (useAsync/usePaginatedList).`
    );
  }
}

console.log("[architecture] detail pages guard passed.");
