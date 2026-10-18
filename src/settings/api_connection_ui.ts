import { setIcon, setTooltip, Setting } from 'obsidian';
import { apiConnectionStatusLine, type ApiConnectionOutcome, type ApiConnectionResult } from './api_connection_probe';

export interface GoogleBooksCooldownMonitor {
  isActive: () => boolean;
  statusLine: () => string | null;
  subscribe: (listener: () => void) => () => void;
}

export interface ApiConnectionUiOptions {
  containerEl: HTMLElement;
  /** Setting row title, e.g. "Google Books API connection". */
  name: string;
  /** Short setting description (not the outcome tooltip). */
  desc: string;
  isConfigured: () => boolean;
  runProbe: () => Promise<ApiConnectionResult>;
  /** When true, run one probe after mount if credentials are configured. */
  autoTestOnMount?: boolean;
  /** Override default (i) tooltip before the first test run. */
  readyDetail?: string;
  /** Shared Google Books cooldown (disables Test connection + live countdown). */
  googleBooksCooldown?: GoogleBooksCooldownMonitor;
}

export interface ApiConnectionUiHandle {
  refreshConfiguredState: () => void;
  runTest: () => Promise<void>;
}

export function mountApiConnectionUi(options: ApiConnectionUiOptions): ApiConnectionUiHandle {
  let outcome: ApiConnectionOutcome = options.isConfigured() ? 'not_configured' : 'not_configured';
  let tooltipDetail =
    options.readyDetail ??
    (options.isConfigured()
      ? 'Credentials are linked. Run Test connection to verify them against the live API.'
      : 'Link the required secrets above before testing.');

  let statusRow: HTMLElement | undefined;
  let statusLine: HTMLElement | undefined;
  let infoEl: HTMLElement | undefined;

  const ensureStatusRow = (): void => {
    if (statusRow) {
      return;
    }
    statusRow = options.containerEl.createDiv({ cls: 'book-search-plugin__api-connection' });
    statusLine = statusRow.createSpan({ cls: 'book-search-plugin__api-connection-line' });
    infoEl = statusRow.createSpan({ cls: 'book-search-plugin__api-connection-info' });
    setIcon(infoEl, 'info');
  };

  const paint = (): void => {
    ensureStatusRow();
    if (!statusLine || !infoEl) {
      return;
    }
    const cooldownLine = options.googleBooksCooldown?.isActive() ? options.googleBooksCooldown.statusLine() : null;
    const showReady = !cooldownLine && options.isConfigured() && outcome === 'not_configured';
    const line = cooldownLine ?? (showReady ? 'Ready to test' : apiConnectionStatusLine(outcome));
    statusLine.setText(line);
    statusLine.setAttr('data-connection-outcome', cooldownLine ? 'cooldown' : showReady ? 'ready' : outcome);
    infoEl.setAttr('aria-label', cooldownLine ?? tooltipDetail);
    setTooltip(infoEl, cooldownLine ?? tooltipDetail, { delay: 300 });
    const cooldownActive = Boolean(cooldownLine);
    testButton?.toggleAttribute('disabled', cooldownActive || !options.isConfigured() || outcome === 'checking');
  };

  let testButton: HTMLButtonElement | undefined;

  const setOutcome = (result: ApiConnectionResult): void => {
    outcome = result.outcome;
    tooltipDetail = result.detail;
    paint();
    testButton?.toggleAttribute('disabled', outcome === 'checking');
  };

  const runTest = async (): Promise<void> => {
    if (options.googleBooksCooldown?.isActive()) {
      const line = options.googleBooksCooldown.statusLine();
      if (line) {
        setOutcome({ outcome: 'quota_exceeded', detail: line });
      }
      return;
    }
    if (!options.isConfigured()) {
      setOutcome({
        outcome: 'not_configured',
        detail: 'Link the required secrets above before testing.',
      });
      return;
    }
    setOutcome({ outcome: 'checking', detail: 'Contacting the provider…' });
    const result = await options.runProbe();
    setOutcome(result);
  };

  new Setting(options.containerEl)
    .setName(options.name)
    .setDesc(options.desc)
    .addButton(button => {
      testButton = button.buttonEl;
      button.setButtonText('Test connection').onClick(() => {
        void runTest();
      });
      button.buttonEl.toggleAttribute('disabled', !options.isConfigured());
    });

  ensureStatusRow();
  paint();

  const handle: ApiConnectionUiHandle = {
    refreshConfiguredState: () => {
      if (!options.isConfigured() && outcome !== 'checking') {
        setOutcome({
          outcome: 'not_configured',
          detail: 'Link the required secrets above before testing.',
        });
      }
      testButton?.toggleAttribute(
        'disabled',
        Boolean(options.googleBooksCooldown?.isActive()) || !options.isConfigured() || outcome === 'checking',
      );
    },
    runTest,
  };

  if (options.autoTestOnMount && options.isConfigured()) {
    void runTest();
  }

  if (options.googleBooksCooldown) {
    options.googleBooksCooldown.subscribe(() => paint());
  }

  return handle;
}
