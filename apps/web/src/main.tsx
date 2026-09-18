import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./styles.css";
import { App } from "./App.js";
import { Layout } from "./components/Layout.js";
import { Ask } from "./pages/Ask.js";
import { CaptureOverview } from "./pages/CaptureOverview.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Graph } from "./pages/Graph.js";
import { Handover } from "./pages/Handover.js";
import { InterviewRoom } from "./pages/InterviewRoom.js";
import { Knowledge } from "./pages/Knowledge.js";
import { NewCapture } from "./pages/NewCapture.js";
import { Settings } from "./pages/Settings.js";

const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: "/", element: <Dashboard /> },
          { path: "/new", element: <NewCapture /> },
          { path: "/c/:id", element: <CaptureOverview /> },
          { path: "/c/:id/knowledge", element: <Knowledge /> },
          { path: "/c/:id/ask", element: <Ask /> },
          { path: "/c/:id/handover", element: <Handover /> },
          { path: "/settings", element: <Settings /> },
        ],
      },
      { path: "/c/:id/interview", element: <InterviewRoom /> },
      { path: "/c/:id/graph", element: <Graph /> },
    ],
  },
], { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || undefined });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
