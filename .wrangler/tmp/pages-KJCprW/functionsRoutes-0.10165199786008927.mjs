import { onRequestPost as __api_tutor_js_onRequestPost } from "C:\\Users\\Shreyas Pavuluri\\code\\qubits\\functions\\api\\tutor.js"

export const routes = [
    {
      routePath: "/api/tutor",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_tutor_js_onRequestPost],
    },
  ]