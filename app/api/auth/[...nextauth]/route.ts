/**
 * NextAuth Route Handler - PRODUCTION READY ✅
 * รองรับหลาย user พร้อมกัน + ป้องกัน token leak
 */

import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

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
  ],
  
  callbacks: {
    async jwt({ token, account, user }: any) {
      // ✅ เพิ่ม userId เพื่อ isolate token
      if (user) {
        token.userId = user.id;
      }

      // ✅ เก็บ token เฉพาะของ user นี้
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = Date.now() + (account.expires_in || 3600) * 1000;
        token.scope = account.scope; // ✅ เก็บ scope ด้วย
      }

      // ✅ Auto-refresh with error handling
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
      return `${baseUrl}/home`;
    },
  },
  
  pages: {
    signIn: "/login",
    error: "/auth/error", // ✅ เพิ่ม error page
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 วัน
    updateAge: 60 * 60, // update ทุก 1 ชั่วโมง
  },

  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },

  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };