import NextAuth from "next-auth";
import { authOptions } from "@/auth";

// Validate NEXTAUTH_SECRET is set
if (!process.env.NEXTAUTH_SECRET) {
  console.error(
    "[NextAuth] ERROR: NEXTAUTH_SECRET environment variable is not set!"
  );
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
