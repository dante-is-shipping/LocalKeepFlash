import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'en',
    minimum_chrome_version: '122',
    permissions: ['activeTab', 'contextMenus', 'scripting', 'storage'],
    host_permissions: ['http://*/*', 'https://*/*'],
    incognito: 'not_allowed',
    action: {
      default_title: '__MSG_savePage__',
    },
    icons: {
      16: '/icon-16.png',
      32: '/icon-32.png',
      48: '/icon-48.png',
      128: '/icon-128.png',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    commands: {
      'save-current-page': {
        suggested_key: {
          default: 'Alt+Shift+S',
          mac: 'MacCtrl+Shift+S',
        },
        description: '__MSG_saveCommand__',
      },
    },
  },
});
