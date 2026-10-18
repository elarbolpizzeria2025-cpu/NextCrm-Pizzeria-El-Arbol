import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import PizzeriaStorefront from './components/PizzeriaStorefront.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname.startsWith('/tienda') ? <PizzeriaStorefront /> : <App />}
  </StrictMode>,
);
