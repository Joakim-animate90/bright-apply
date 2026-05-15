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
  content_scripts: [
    {
      matches: ['https://*.brightermonday.co.ke/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],
  permissions: ['tabs', 'cookies', 'storage', 'scripting', 'activeTab'],
  host_permissions: [
    'https://www.brightermonday.co.ke/*',
    'https://brightermonday.co.ke/*',
    'https://*.brightermonday.co.ke/*',
  ],
  web_accessible_resources: [
    {
      resources: ['assets/*'],
      matches: ['https://*.brightermonday.co.ke/*'],
    },
  ],
});
