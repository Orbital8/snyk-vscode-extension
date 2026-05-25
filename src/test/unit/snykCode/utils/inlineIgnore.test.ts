import { strictEqual } from 'assert';
import { makeMockCodeIssue } from '../../mocks/issue.mock';
import {
  hasLegacyInlineIgnore,
  hasSnykCodeInlineIgnore,
  matchesSnykCodeInlineIgnore,
} from '../../../../snyk/snykCode/utils/inlineIgnore';

suite('Snyk Code inline ignore utils', () => {
  test('matches snyk:ignore comment on the same line', () => {
    const issue = makeMockCodeIssue({
      title: 'Use of Hardcoded Credentials',
    });

    const line = 'password := "mockpw" // snyk:ignore:Use of Hardcoded Credentials';

    strictEqual(matchesSnykCodeInlineIgnore(issue, ['', line]), true);
  });

  test('matches snyk:ignore comment on the previous line', () => {
    const issue = makeMockCodeIssue({
      title: 'Use of Hardcoded Credentials',
    });

    const previousLine = '// snyk:ignore:Use of Hardcoded Credentials';
    const line = 'password := "mockpw"';

    strictEqual(matchesSnykCodeInlineIgnore(issue, [previousLine, line]), true);
  });

  test('does not match a non-matching snyk:ignore title', () => {
    const issue = makeMockCodeIssue({
      title: 'Use of Hardcoded Credentials',
    });

    const previousLine = '// snyk:ignore:SQL Injection';
    const line = 'password := "mockpw"';

    strictEqual(matchesSnykCodeInlineIgnore(issue, [previousLine, line]), false);
  });

  test('matches the UI-visible title when the raw issue title contains a colon suffix', () => {
    const issue = makeMockCodeIssue({
      title: 'Use of Hardcoded Credentials: Hardcoded password detected',
      range: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 0 },
      },
    });

    const previousLine = '// snyk:ignore:Use of Hardcoded Credentials';
    const line = 'password := "mockpw"';

    strictEqual(matchesSnykCodeInlineIgnore(issue, [previousLine, line]), true);
  });

  test('does not let a same-line comment on the previous line ignore the next issue line', () => {
    const issue = makeMockCodeIssue({
      title: 'Use of Hardcoded Credentials',
    });

    const previousLine =
      'public const string NewPassword = "NewPassword"; // snyk:ignore:Use of Hardcoded Credentials';
    const line = 'public const string SharedSecret = "SharedSecret";';

    strictEqual(matchesSnykCodeInlineIgnore(issue, [previousLine, line]), false);
  });

  test('does not treat a previous line with code plus comment as a standalone previous-line ignore', () => {
    const issue = makeMockCodeIssue({
      title: 'Use of Hardcoded Credentials',
    });

    const previousLine = 'const a = 1; // snyk:ignore:Use of Hardcoded Credentials';
    const line = 'password := "mockpw"';

    strictEqual(matchesSnykCodeInlineIgnore(issue, [previousLine, line]), false);
  });

  test('recognizes the new comment format directly', () => {
    strictEqual(hasSnykCodeInlineIgnore('// snyk:ignore:Use of Hardcoded Credentials'), true);
  });

  test('recognizes legacy deepcode issue comments', () => {
    strictEqual(hasLegacyInlineIgnore('// deepcode ignore mock-rule: <reason>', 'mock-rule'), true);
  });
});
