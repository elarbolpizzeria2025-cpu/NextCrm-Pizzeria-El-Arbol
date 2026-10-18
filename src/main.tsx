import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import PizzeriaLanding from './components/PizzeriaLanding.tsx';
import './index.css';

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const isPizzeriaLanding = ['/pizzeria', '/presentacion', '/landing-pizzeria'].includes(path);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPizzeriaLanding ? <PizzeriaLanding /> : <App />}
  </StrictMode>,
);
