import { strictEqual } from 'assert';
import sinon from 'sinon';
import { SNYK_IGNORE_ISSUE_COMMAND, SNYK_OPEN_ISSUE_COMMAND } from '../../../../snyk/common/constants/commands';
import { CodeIssueData, Issue } from '../../../../snyk/common/languageServer/types';
import { WorkspaceFolderResult } from '../../../../snyk/common/services/productService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../../../snyk/common/vscode/codeAction';
import { IVSCodeLanguages } from '../../../../snyk/common/vscode/languages';
import { CodeActionContext, CodeActionKind, Range, TextDocument } from '../../../../snyk/common/vscode/types';
import { SnykCodeActionsProvider } from '../../../../snyk/snykCode/codeActions/codeIssuesActionsProvider';
import { IssueUtils } from '../../../../snyk/snykCode/utils/issueUtils';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { IFolderConfigs } from '../../../../snyk/common/configuration/folderConfigs';
import { FEATURE_FLAGS } from '../../../../snyk/common/constants/featureFlags';
import { makeMockCodeIssue } from '../../mocks/issue.mock';

suite('Snyk Code actions provider', () => {
  let issuesActionsProvider: SnykCodeActionsProvider;
  let configuration: IConfiguration;
  let folderConfigs: IFolderConfigs;
  let codeResults: Map<string, WorkspaceFolderResult<CodeIssueData>>;
  let codeActionAdapter: ICodeActionAdapter;
  let codeActionKindAdapter: ICodeActionKindAdapter;

  setup(() => {
    codeResults = new Map<string, WorkspaceFolderResult<CodeIssueData>>();
    codeResults.set('folderName', {
      isSuccess: true,
      issues: [
        makeMockCodeIssue({
          filePath: '//folderName//test.js',
          title: 'Mock Code issue',
          additionalData: {
            rule: 'some-rule',
          },
        }) as Issue<CodeIssueData>,
      ],
    });

    codeActionAdapter = {
      create: (_: string, _kind?: CodeActionKind) => ({
        command: {},
      }),
    } as ICodeActionAdapter;

    codeActionKindAdapter = {
      getQuickFix: sinon.fake(),
    } as ICodeActionKindAdapter;

    const rangeMock = {
      contains: () => true,
    } as unknown as Range;

    sinon.stub(IssueUtils, 'createVsCodeRange').returns(rangeMock);

    configuration = {
      getFeatureFlag(_: string): boolean {
        return true;
      },
    } as IConfiguration;

    folderConfigs = {
      getFolderConfig: (_config: IConfiguration, _folderPath: string) => ({
        folderPath: 'folderName',
        baseBranch: '',
        localBranches: undefined,
        referenceFolderPath: undefined,
        featureFlags: {
          [FEATURE_FLAGS.snykCodeInlineIgnore]: true,
        },
      }),
    } as IFolderConfigs;

    issuesActionsProvider = new SnykCodeActionsProvider(
      codeResults,
      codeActionAdapter,
      codeActionKindAdapter,
      {} as IVSCodeLanguages,
      configuration,
      folderConfigs,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Provides code actions, inline ignores disabled', () => {
    // arrange
    const document = {
      uri: {
        fsPath: '//folderName//test.js',
      },
    } as unknown as TextDocument;

    const folderConfigsDisabled = {
      getFolderConfig: (_config: IConfiguration, _folderPath: string) => ({
        folderPath: 'folderName',
        baseBranch: '',
        localBranches: undefined,
        referenceFolderPath: undefined,
        featureFlags: {
          [FEATURE_FLAGS.snykCodeInlineIgnore]: false,
        },
      }),
    } as IFolderConfigs;

    issuesActionsProvider = new SnykCodeActionsProvider(
      codeResults,
      codeActionAdapter,
      codeActionKindAdapter,
      {} as IVSCodeLanguages,
      configuration,
      folderConfigsDisabled,
    );

    // act
    const codeActions = issuesActionsProvider.provideCodeActions(document, {} as Range, {} as CodeActionContext);

    // verify
    strictEqual(codeActions?.length, 1);
    strictEqual(codeActions[0].command?.command, SNYK_OPEN_ISSUE_COMMAND);
  });

  test('Provides code actions, inline ignores enabled', () => {
    // arrange
    const document = {
      uri: {
        fsPath: '//folderName//test.js',
      },
    } as unknown as TextDocument;

    // act
    const codeActions = issuesActionsProvider.provideCodeActions(document, {} as Range, {} as CodeActionContext);

    // verify
    strictEqual(codeActions?.length, 3);
    strictEqual(codeActions[0].command?.command, SNYK_OPEN_ISSUE_COMMAND);
    strictEqual(codeActions[1].command?.command, SNYK_IGNORE_ISSUE_COMMAND);
    strictEqual(codeActions[2].command?.command, SNYK_IGNORE_ISSUE_COMMAND);
  });

  test('Uses the issue title for issue-level ignores and keeps file ignore legacy args', () => {
    const document = {
      uri: {
        fsPath: '//folderName//test.js',
      },
    } as unknown as TextDocument;

    const codeActions = issuesActionsProvider.provideCodeActions(document, {} as Range, {} as CodeActionContext);

    strictEqual(codeActions?.[1].command?.arguments?.[0].ruleId, 'some-rule');
    strictEqual(codeActions?.[1].command?.arguments?.[0].issueTitle, undefined);
    strictEqual(codeActions?.[2].command?.arguments?.[0].ruleId, undefined);
    strictEqual(codeActions?.[2].command?.arguments?.[0].issueTitle, 'Mock Code issue');
  });

  test('Uses the UI-visible title for issue-level ignore comments when raw title contains details', () => {
    codeResults.set('folderName', {
      isSuccess: true,
      issues: [
        makeMockCodeIssue({
          filePath: '//folderName//test.js',
          title: 'Use of Hardcoded Credentials: Hardcoded password detected',
          additionalData: {
            rule: 'some-rule',
          },
        }) as Issue<CodeIssueData>,
      ],
    });

    const document = {
      uri: {
        fsPath: '//folderName//test.js',
      },
    } as unknown as TextDocument;

    const codeActions = issuesActionsProvider.provideCodeActions(document, {} as Range, {} as CodeActionContext);

    strictEqual(codeActions?.[2].command?.arguments?.[0].issueTitle, 'Use of Hardcoded Credentials');
  });
});
