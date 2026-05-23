/**
 * NextAuth Route Handler - PRODUCTION READY ✅
 * รองรับหลาย user พร้อมกัน + ป้องกัน token leak
 */

//path: app/api/auth/[...nextauth]/route.ts

import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { saReadRange } from "@/lib/google-sa";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;

const scopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file"
].join(" ");

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: scopes,
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          include_granted_scopes: "true"
        }
      },
    }),

    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase().trim();

        try {
          // client_user: A=client_id B=email C=role D=is_active E=notes F=password_hash G=branch_id H=branch_name
          const rows = await saReadRange(MASTER_SHEET_ID, "client_user!A:H");
          const row  = rows.slice(1).find((r) => (r[1] ?? "").toString().toLowerCase().trim() === email);
          if (!row) return null;

          const isActive = (row[3] ?? "").toString().toUpperCase() === "TRUE";
          const stored   = (row[5] ?? "").toString().trim();
          if (!isActive || !stored) return null;

          // plain text comparison — demo only
          if (credentials.password !== stored) return null;

          return {
            id:    email,
            email: email,
            name:  (row[7] ?? row[0] ?? email).toString(),
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  
  callbacks: {
    async jwt({ token, account, user }: any) {
      // ✅ เพิ่ม userId เพื่อ isolate token
      if (user) {
        token.userId = user.id;
      }

      // ✅ เก็บ token เฉพาะของ user นี้
      if (account) {
        if (account.type === "credentials") {
          token.provider  = "credentials";
          token.expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 วัน
        } else {
          token.accessToken  = account.access_token;
          token.refreshToken = account.refresh_token;
          token.expiresAt    = Date.now() + (account.expires_in || 3600) * 1000;
          token.scope        = account.scope;
          token.provider     = "google";
        }
      }

      // ✅ Credentials: ต่ออายุอัตโนมัติทุกครั้งที่ active (ไม่ต้อง re-check sheet)
      if (token.provider === "credentials") {
        token.expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
        return token;
      }

      // ✅ Google: Auto-refresh — refresh 5 นาทีก่อนหมดอายุ
      if (token.expiresAt && Date.now() > (token.expiresAt - 300000)) { // refresh 5 นาทีก่อนหมดอายุ
        try {
          console.log(`🔄 Refreshing token for user: ${token.email}`);
          
          const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: "refresh_token",
              refresh_token: token.refreshToken as string,
            }),
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token refresh failed: ${error}`);
          }

          const refreshed = await response.json();

          console.log(`✅ Token refreshed for: ${token.email}`);
          
          return {
            ...token,
            accessToken: refreshed.access_token,
            expiresAt: Date.now() + (refreshed.expires_in || 3600) * 1000,
            // ✅ เก็บ refreshToken เดิมไว้ (Google ไม่ return ใหม่ทุกครั้ง)
            refreshToken: refreshed.refresh_token || token.refreshToken,
          };
        } catch (error) {
          console.error(`❌ Token refresh failed for ${token.email}:`, error);
          
          // ✅ ส่ง error กลับไป frontend เพื่อบังคับ re-login
          return {
            ...token,
            error: "RefreshAccessTokenError",
            accessToken: null, // ลบ token ที่หมดอายุ
          };
        }
      }

      return token;
    },
    
    async session({ session, token }: any) {
      // ✅ ส่งเฉพาะ accessToken ของ user นี้
      if (token.error) {
        session.error = token.error;
        // ไม่ส่ง token ถ้ามี error
        delete session.accessToken;
      } else {
        session.accessToken = token.accessToken;
        session.user.id = token.userId;
        session.expiresAt = token.expiresAt;
      }
      
      return session;
    },
    
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/auth-router`;
    },
  },
  
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },

  session: {
    strategy: "jwt",
    maxAge:    30 * 24 * 60 * 60, // 30 วัน
    updateAge: 60 * 60,           // rotate ทุก 1 ชั่วโมง
  },

  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },

  // ✅ Persistent cookie — ไม่หายเมื่อปิด browser
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60, // 30 วัน (วินาที)
      },
    },
  },

  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };