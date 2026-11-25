import axios from "axios";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request interceptor to attach JWT/Sanctum bearer token and Active Period header
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("ninu_arts_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Attach global active working month (defaults to current YYYY-MM if not set)
  const activePeriod = localStorage.getItem("ninu_arts_active_period");
  if (activePeriod) {
    config.headers["X-Active-Period"] = activePeriod;
  }
  return config;
});

// Response interceptor to catch 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("ninu_arts_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
