import path from 'path';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';
import {
  FILE_IGNORE_ISSUE_BASE_COMMENT_TEXT,
  IGNORE_ISSUE_BASE_COMMENT_TEXT,
  IGNORE_ISSUE_REASON_TIP,
} from '../constants/analysis';
import { buildSnykCodeInlineIgnoreComment } from './inlineIgnore';

export const ignoreIssueCommentText = ({
  issueTitle,
  ruleId,
  isFileIgnore,
}: {
  issueTitle?: string;
  ruleId?: string;
  isFileIgnore?: boolean;
}): string => {
  if (!isFileIgnore && issueTitle) {
    return buildSnykCodeInlineIgnoreComment(issueTitle);
  }

  const snykComment = isFileIgnore ? FILE_IGNORE_ISSUE_BASE_COMMENT_TEXT : IGNORE_ISSUE_BASE_COMMENT_TEXT;
  return `${snykComment} ${ruleId}: ${IGNORE_ISSUE_REASON_TIP}`;
};

export const getInlineIgnoreCommentTitle = (title: string): string => title.split(':')[0].trim();

export const getAbsoluteMarkerFilePath = (
  workspace: IVSCodeWorkspace,
  markerFilePath: string,
  suggestionFilePath: string,
): string => {
  if (!markerFilePath) {
    // If no filePath reported, use suggestion file path as marker's path. Suggestion path is always absolute.
    return suggestionFilePath;
  }

  const workspaceFolders = workspace.getWorkspaceFolderPaths();
  if (workspaceFolders.length > 1) {
    return markerFilePath;
  }

  // The Snyk Code analysis reported marker path is relative when in workspace with a single folder, thus need to convert to an absolute
  return path.resolve(workspaceFolders[0], markerFilePath);
};
