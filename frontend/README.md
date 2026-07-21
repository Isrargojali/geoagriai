# @geoagri/frontend

React 18 + Vite SPA for GeoAgri AI (TailwindCSS, React Router, React Query,
Leaflet + leaflet-draw, Chart.js, dark mode).

- **Dev:** `npm run dev -w @geoagri/frontend` → http://localhost:5173
- **Build:** `npm run build -w @geoagri/frontend` (typecheck + Vite build)
- **Tests:** `npm run test -w @geoagri/frontend`

Configure the API endpoint with `VITE_API_BASE_URL` (defaults to
`http://localhost:4000/api/v1`; the Docker build uses `/api/v1` behind nginx).
