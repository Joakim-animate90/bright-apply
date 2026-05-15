import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'BrightApply',
  description:
    'One-click job applications on BrighterMonday using your existing browser session.',
  version: pkg.version,
  action: {
    default_popup: 'index.html',
    default_title: 'BrightApply',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  // No declarative content_scripts: the scraper is injected on demand via
  // `chrome.scripting.executeScript`, which avoids load-order races and the
  // strict-CSP gotchas of dynamic-import loaders.
  permissions: ['tabs', 'cookies', 'storage', 'scripting', 'activeTab'],
  host_permissions: [
    'https://www.brightermonday.co.ke/*',
    'https://brightermonday.co.ke/*',
    'https://*.brightermonday.co.ke/*',
  ],
});
