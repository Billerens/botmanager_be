import api from "./api";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    telegramId?: string;
    telegramUsername?: string;
    role: "owner" | "admin" | "manager";
    isActive: boolean;
    isEmailVerified: boolean;
    lastLoginAt?: string;
    createdAt: string;
    updatedAt: string;
  };
  accessToken: string;
}

export const authService = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await api.post("/auth/login", credentials);
    return response.data;
  },

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await api.post("/auth/register", userData);
    return response.data;
  },

  async refreshToken(): Promise<{ accessToken: string }> {
    const response = await api.post("/auth/refresh");
    return response.data;
  },

  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    await api.post("/auth/change-password", data);
  },

  async requestPasswordReset(email: string): Promise<void> {
    await api.post("/auth/request-password-reset", { email });
  },

  async resetPassword(data: {
    token: string;
    newPassword: string;
  }): Promise<void> {
    await api.post("/auth/reset-password", data);
  },

  async verifyEmail(token: string): Promise<void> {
    await api.get(`/auth/verify-email?token=${token}`);
  },

  async resendVerification(email: string): Promise<void> {
    await api.post("/auth/resend-verification", { email });
  },

  async getProfile(): Promise<AuthResponse["user"]> {
    const response = await api.get("/auth/me");
    return response.data;
  },

  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
  }): Promise<AuthResponse["user"]> {
    const response = await api.patch("/auth/profile", data);
    return response.data;
  },
};
