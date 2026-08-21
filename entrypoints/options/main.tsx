import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsApp } from '@/ui/settings/SettingsApp';
import '@/ui/settings/settings.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsApp mode="options" />
  </StrictMode>,
);
