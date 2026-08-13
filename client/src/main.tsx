import 'bootstrap/dist/css/bootstrap.min.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return (
    <main className="container py-5">
      <p className="text-uppercase text-secondary small fw-semibold">CPE334 / Lab 01</p>
      <h1 className="display-4 fw-bold">TokTickIT</h1>
      <p className="lead">IT service-desk foundation is ready.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
