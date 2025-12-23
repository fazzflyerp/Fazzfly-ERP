/**
 * NextAuth Route Handler - CORRECTED
 * Location: app/api/auth/[...nextauth]/route.ts
 *
 * ✅ ใช้ drive.file สำหรับ upload ไฟล์
 */

import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const scopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file"  // ✅ แก้เป็น drive.file
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
    async jwt({ token, account }: any) {
      // เก็บ accessToken + refreshToken เมื่อ login ครั้งแรก
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = Date.now() + (account.expires_in || 3600) * 1000;
      }

      // ถ้า token หมดอายุ ให้ refresh ใหม่
      if (token.expiresAt && Date.now() > token.expiresAt) {
        try {
          console.log("🔄 Refreshing Google token...");
          
          const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: "refresh_token",
              refresh_token: token.refreshToken as string,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to refresh token");
          }

          const refreshed = await response.json();

          console.log("✅ Token refreshed successfully");
          
          return {
            ...token,
            accessToken: refreshed.access_token,
            expiresAt: Date.now() + (refreshed.expires_in || 3600) * 1000,
          };
        } catch (error) {
          console.error("❌ Token refresh failed:", error);
          return {
            ...token,
            error: "RefreshAccessTokenError",
          };
        }
      }

      return token;
    },
    
    async session({ session, token }: any) {
      // ส่ง accessToken ไป frontend ผ่าน session
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      session.expiresAt = token.expiresAt;
      
      if (token.error) {
        session.error = token.error;
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
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 60 * 60,
  },

  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },

  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };