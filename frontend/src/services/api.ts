import axios from "axios";
import { toast } from "react-hot-toast";

const API_BASE_URL =
  (import.meta as any).env.VITE_API_URL || "http://localhost:3000";

// Создаем экземпляр axios
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Интерцептор для добавления токена
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth-storage");
    if (token) {
      try {
        const authData = JSON.parse(token);
        if (authData.state?.token) {
          config.headers.Authorization = `Bearer ${authData.state.token}`;
        }
      } catch (error) {
        console.error("Ошибка парсинга токена:", error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Интерцептор для обработки ответов
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // Неавторизован - перенаправляем на логин
          localStorage.removeItem("auth-storage");
          break;
        case 403:
          toast.error("Доступ запрещен");
          break;
        case 404:
          toast.error("Ресурс не найден");
          break;
        case 422:
          // Ошибки валидации
          if (data.message) {
            toast.error(data.message);
          } else if (Array.isArray(data.message)) {
            data.message.forEach((msg: string) => toast.error(msg));
          }
          break;
        case 500:
          toast.error("Внутренняя ошибка сервера");
          break;
        default:
          toast.error(data.message || "Произошла ошибка");
      }
    } else if (error.request) {
      toast.error("Ошибка сети. Проверьте подключение к интернету");
    } else {
      toast.error("Произошла неизвестная ошибка");
    }

    return Promise.reject(error);
  }
);

export default api;
