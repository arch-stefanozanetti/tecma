import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { App } from './App';
import { ApiDocsPage } from './features/api-docs/ApiDocsPage';
import { OrganizationSetupPage } from './features/organization/OrganizationSetupPage';
import './styles.css';

const rootElement = document.getElementById('root');
if (rootElement == null) throw new Error('Missing root element');

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/api" element={<ApiDocsPage />} />
        <Route path="/organization/setup" element={<OrganizationSetupPage />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
