import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { Root } from './App';
import { initI18n } from './i18n';

initI18n();
const container = document.getElementById('root');
if (!container) throw new Error('Root container missing');
createRoot(container).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
