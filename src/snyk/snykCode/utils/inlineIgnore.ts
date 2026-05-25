import fs from 'fs';
import { CodeIssueData, Issue } from '../../common/languageServer/types';
import { IGNORE_ISSUE_BASE_COMMENT_TEXT, SNYK_CODE_IGNORE_ISSUE_BASE_COMMENT_TEXT } from '../constants/analysis';

export const getSnykCodeInlineIgnoreTitles = (issue: Issue<CodeIssueData>): string[] => {
  const rawTitle = issue.title.trim();
  const normalizedTitle = rawTitle.split(':')[0].trim();

  return Array.from(new Set([normalizedTitle, rawTitle].filter(Boolean)));
};

export const buildSnykCodeInlineIgnoreComment = (issueTitle: string): string =>
  `${SNYK_CODE_IGNORE_ISSUE_BASE_COMMENT_TEXT}${issueTitle.trim()}`;

export const hasSnykCodeInlineIgnore = (line: string): boolean => line.includes(SNYK_CODE_IGNORE_ISSUE_BASE_COMMENT_TEXT);

export const hasLegacyInlineIgnore = (line: string, rule: string): boolean =>
  line.includes(`${IGNORE_ISSUE_BASE_COMMENT_TEXT} ${rule}`);

export const matchesSnykCodeInlineIgnore = (issue: Issue<CodeIssueData>, searchLines: string[]): boolean => {
  const previousLine = searchLines.length > 1 ? searchLines[0] : '';
  const issueLine = searchLines[searchLines.length - 1] ?? '';

  return getSnykCodeInlineIgnoreTitles(issue).some(title => {
    const comment = buildSnykCodeInlineIgnoreComment(title);
    const hasSameLineIgnore = issueLine.includes(comment);
    const hasStandalonePreviousLineIgnore = previousLine.trim() === `// ${comment}`;

    return hasSameLineIgnore || hasStandalonePreviousLineIgnore;
  });
};

export const getInlineIgnoreSearchDomain = (fileContent: string, lineNumber: number): string[] => {
  const lines = fileContent.split(/\r?\n/);
  if (lineNumber < 0 || lineNumber >= lines.length) {
    return [];
  }

  return lines.slice(Math.max(0, lineNumber - 1), lineNumber + 1);
};

export const isSnykCodeIssueInlineIgnored = (issue: Issue<CodeIssueData>, fileContent: string): boolean => {
  const searchDomain = getInlineIgnoreSearchDomain(fileContent, issue.range.start.line);
  if (searchDomain.length === 0) {
    return false;
  }

  const previousLine = searchDomain.length > 1 ? searchDomain[0] : '';
  const issueLine = searchDomain[searchDomain.length - 1] ?? '';
  const hasLegacyIgnore = issueLine.includes(`${IGNORE_ISSUE_BASE_COMMENT_TEXT} ${issue.additionalData.rule}`);
  const hasStandaloneLegacyIgnore = previousLine.trim() === `// ${IGNORE_ISSUE_BASE_COMMENT_TEXT} ${issue.additionalData.rule}`;

  return matchesSnykCodeInlineIgnore(issue, searchDomain) || hasLegacyIgnore || hasStandaloneLegacyIgnore;
};

export const isSnykCodeIssueInlineIgnoredInFile = (issue: Issue<CodeIssueData>): boolean => {
  try {
    const fileContent = fs.readFileSync(issue.filePath, 'utf8');
    return isSnykCodeIssueInlineIgnored(issue, fileContent);
  } catch {
    return false;
  }
};
