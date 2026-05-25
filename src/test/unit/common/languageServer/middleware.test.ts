import assert from 'assert';
import fs from 'fs';
import sinon from 'sinon';
import {
  DEFAULT_ISSUE_VIEW_OPTIONS,
  DEFAULT_RISK_SCORE_THRESHOLD,
  DEFAULT_SEVERITY_FILTER,
  FolderConfig,
  IConfiguration,
} from '../../../../snyk/common/configuration/configuration';
import { LanguageClientMiddleware } from '../../../../snyk/common/languageServer/middleware';
import { ServerSettings } from '../../../../snyk/common/languageServer/settings';
import { User } from '../../../../snyk/common/user';
import type {
  CancellationToken,
  ConfigurationParams,
  ConfigurationRequestHandlerSignature,
  ResponseError,
  ShowDocumentParams,
  ShowDocumentRequestHandlerSignature,
} from '../../../../snyk/common/vscode/types';
import { IVSCodeCommands } from '../../../../snyk/common/vscode/commands';
import { IUriAdapter } from '../../../../snyk/common/vscode/uri';
import { defaultFeaturesConfigurationStub } from '../../mocks/configuration.mock';
import { ShowIssueDetailTopicParams, LsScanProduct, SnykURIAction } from '../../../../snyk/common/languageServer/types';
import { Subject } from 'rxjs';
import { LoggerMockFailOnErrors } from '../../mocks/logger.mock';
import { makeMockCodeIssue } from '../../mocks/issue.mock';

suite('Language Server: Middleware', () => {
  let configuration: IConfiguration;
  let user: User;

  setup(() => {
    user = { anonymousId: 'anonymous-id' } as User;
    configuration = {
      getAuthenticationMethod(): string {
        return 'oauth';
      },
      shouldReportErrors: false,
      snykApiEndpoint: 'https://dev.snyk.io/api',
      getAdditionalCliParameters: () => '',
      organization: 'org',
      getToken: () => Promise.resolve('token'),
      isAutomaticDependencyManagementEnabled: () => true,
      getCliPath: (): Promise<string> => Promise.resolve('/path/to/cli'),
      getCliBaseDownloadUrl: () => 'https://downloads.snyk.io',
      getInsecure(): boolean {
        return true;
      },
      getDeltaFindingsEnabled(): boolean {
        return false;
      },
      getPreviewFeatures() {
        return {};
      },
      getOssQuickFixCodeActionsEnabled(): boolean {
        return true;
      },
      getFeaturesConfiguration() {
        return defaultFeaturesConfigurationStub;
      },
      severityFilter: DEFAULT_SEVERITY_FILTER,
      riskScoreThreshold: DEFAULT_RISK_SCORE_THRESHOLD,
      issueViewOptions: DEFAULT_ISSUE_VIEW_OPTIONS,
      getTrustedFolders: () => ['/trusted/test/folder'],
      getFolderConfigs(): FolderConfig[] {
        return [];
      },
      getSecureAtInceptionExecutionFrequency(): string {
        return 'Manual';
      },
      getAutoConfigureMcpServer(): boolean {
        return false;
      },
    } as IConfiguration;
  });

  teardown(() => {
    sinon.restore();
  });

  test('Configuration request should translate settings', async () => {
    const middleware = new LanguageClientMiddleware(
      new LoggerMockFailOnErrors(),
      configuration,
      user,
      new Subject<ShowIssueDetailTopicParams>(),
      {} as IUriAdapter,
      {} as IVSCodeCommands,
    );
    const params: ConfigurationParams = {
      items: [
        {
          section: 'snyk',
        },
      ],
    };
    const handler: ConfigurationRequestHandlerSignature = (_params, _token) => {
      return [{}];
    };

    const token: CancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested: sinon.fake(),
    };

    const res = await middleware.workspace.configuration(params, token, handler);
    if (res instanceof Error) {
      assert.fail('Handler returned an error');
    }

    const serverResult = res[0] as ServerSettings;
    assert.strictEqual(serverResult.activateSnykCodeSecurity, 'true');
    assert.strictEqual(serverResult.activateSnykOpenSource, 'false');
    assert.strictEqual(serverResult.activateSnykIac, 'true');
    assert.strictEqual(serverResult.activateSnykSecrets, 'false');
    assert.strictEqual(serverResult.endpoint, configuration.snykApiEndpoint);
    assert.strictEqual(serverResult.additionalParams, configuration.getAdditionalCliParameters());
    assert.strictEqual(serverResult.sendErrorReports, `${configuration.shouldReportErrors}`);
    assert.strictEqual(serverResult.organization, `${configuration.organization}`);
    assert.strictEqual(
      serverResult.manageBinariesAutomatically,
      `${configuration.isAutomaticDependencyManagementEnabled()}`,
    );
    assert.strictEqual(serverResult.cliPath, await configuration.getCliPath());
    assert.strictEqual(serverResult.enableTrustedFoldersFeature, 'true');
    assert.deepStrictEqual(serverResult.trustedFolders, configuration.getTrustedFolders());
  });

  test('Configuration request should return an error', async () => {
    const middleware = new LanguageClientMiddleware(
      new LoggerMockFailOnErrors(),
      configuration,
      user,
      new Subject<ShowIssueDetailTopicParams>(),
      {} as IUriAdapter,
      {} as IVSCodeCommands,
    );
    const params: ConfigurationParams = {
      items: [
        {
          section: 'snyk',
        },
      ],
    };
    const handler: ConfigurationRequestHandlerSignature = (_params, _token) => {
      return new Error('test err') as ResponseError;
    };

    const token: CancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested: sinon.fake(),
    };

    const res = await middleware.workspace.configuration(params, token, handler);
    if (!(res instanceof Error)) {
      console.log(res);
      assert.fail("Handler didn't return an error");
    }
  });

  test(`Snyk URI for action=${SnykURIAction.ShowInDetailPanel} should trigger show issue detail topic publish`, async () => {
    const product = LsScanProduct.Code;
    const issueId = '123abc456';

    const showIssueDetailTopic$ = new Subject<ShowIssueDetailTopicParams>();
    const subscribedTopicMessageRecieved = new Promise<ShowIssueDetailTopicParams>(resolve => {
      let calledAlready = false;
      showIssueDetailTopic$.subscribe(showIssueDetailTopicParams => {
        assert.strictEqual(calledAlready, false, 'Show issue detail topic published to multiple times');
        calledAlready = true;
        resolve(showIssueDetailTopicParams);
      });
    });

    const middleware = new LanguageClientMiddleware(
      new LoggerMockFailOnErrors(),
      {} as IConfiguration,
      {} as User,
      showIssueDetailTopic$,
      {} as IUriAdapter,
      {} as IVSCodeCommands,
    );
    const params: ShowDocumentParams = {
      uri: `snyk:///fake/file/path?product=${product.replaceAll(' ', '+')}&issueId=${issueId}&action=${
        SnykURIAction.ShowInDetailPanel
      }`,
    };
    const failOnNextHandler: ShowDocumentRequestHandlerSignature = (_params, _token) => {
      return { success: false };
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const res = await middleware.window.showDocument?.(params, failOnNextHandler);
    if (res === undefined) {
      assert.fail('Failed to call showDocument');
    }
    if (res instanceof Error) {
      assert.fail('Handler returned an error');
    }
    assert.deepStrictEqual(res, { success: true });

    const showIssueDetailTopicParams = await subscribedTopicMessageRecieved;
    assert.deepStrictEqual(showIssueDetailTopicParams, {
      product,
      issueId,
    });
  });

  test('handleDiagnostics filters inline-ignored Snyk Code diagnostics before they reach VS Code', () => {
    const issue = makeMockCodeIssue({
      filePath: '/repo/test.js',
      title: 'Use of Hardcoded Credentials',
      range: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 0 },
      },
      additionalData: { rows: [1, 1] },
    });
    sinon
      .stub(fs, 'readFileSync')
      .withArgs(issue.filePath, 'utf8')
      .returns('const a = 1;\npassword = "mock" // snyk:ignore:Use of Hardcoded Credentials\n');

    const middleware = new LanguageClientMiddleware(
      new LoggerMockFailOnErrors(),
      {} as IConfiguration,
      {} as User,
      new Subject<ShowIssueDetailTopicParams>(),
      {} as IUriAdapter,
      {} as IVSCodeCommands,
    );
    const next = sinon.fake();

    middleware.handleDiagnostics?.(
      {
        fsPath: issue.filePath,
        scheme: 'file',
      } as unknown as import('../../../../snyk/common/vscode/types').Uri,
      [
        {
          source: LsScanProduct.Code,
          data: issue,
        } as unknown as import('../../../../snyk/common/vscode/types').Diagnostic,
      ],
      next,
    );

    sinon.assert.calledOnce(next);
    assert.deepStrictEqual(next.firstCall.args[1], []);
  });

  test('handleDiagnostics leaves non-Code diagnostics untouched', () => {
    const diagnostic = {
      source: LsScanProduct.OpenSource,
    } as unknown as import('../../../../snyk/common/vscode/types').Diagnostic;

    const middleware = new LanguageClientMiddleware(
      new LoggerMockFailOnErrors(),
      {} as IConfiguration,
      {} as User,
      new Subject<ShowIssueDetailTopicParams>(),
      {} as IUriAdapter,
      {} as IVSCodeCommands,
    );
    const next = sinon.fake();

    middleware.handleDiagnostics?.(
      {
        fsPath: '/repo/package.json',
        scheme: 'file',
      } as unknown as import('../../../../snyk/common/vscode/types').Uri,
      [diagnostic],
      next,
    );

    sinon.assert.calledOnce(next);
    assert.deepStrictEqual(next.firstCall.args[1], [diagnostic]);
  });

  test('handleDiagnostics only filters the issue on the exact commented line when consecutive lines both have issues', () => {
    const ignoredIssue = makeMockCodeIssue({
      id: 'ignored-issue',
      filePath: '/repo/test.cs',
      title: 'Use of Hardcoded Credentials',
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    });
    const visibleIssue = makeMockCodeIssue({
      id: 'visible-issue',
      filePath: '/repo/test.cs',
      title: 'Use of Hardcoded Credentials',
      range: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 0 },
      },
    });

    sinon.stub(fs, 'readFileSync').withArgs('/repo/test.cs', 'utf8').returns(
      'public const string NewPassword = "NewPassword"; // snyk:ignore:Use of Hardcoded Credentials\n' +
        'public const string SharedSecret = "SharedSecret";\n',
    );

    const middleware = new LanguageClientMiddleware(
      new LoggerMockFailOnErrors(),
      {} as IConfiguration,
      {} as User,
      new Subject<ShowIssueDetailTopicParams>(),
      {} as IUriAdapter,
      {} as IVSCodeCommands,
    );
    const next = sinon.fake();

    middleware.handleDiagnostics?.(
      {
        fsPath: '/repo/test.cs',
        scheme: 'file',
      } as unknown as import('../../../../snyk/common/vscode/types').Uri,
      [
        {
          source: LsScanProduct.Code,
          data: ignoredIssue,
        } as unknown as import('../../../../snyk/common/vscode/types').Diagnostic,
        {
          source: LsScanProduct.Code,
          data: visibleIssue,
        } as unknown as import('../../../../snyk/common/vscode/types').Diagnostic,
      ],
      next,
    );

    sinon.assert.calledOnce(next);
    assert.strictEqual(next.firstCall.args[1].length, 1);
    assert.strictEqual(next.firstCall.args[1][0].data.id, 'visible-issue');
  });
});
