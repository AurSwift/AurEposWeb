// Script to generate bcrypt hash for demo password
// Run with: npx tsx scripts/generate-demo-password.ts

import bcrypt from "bcryptjs";

async function generateHash() {
  const password = "demo123";
  const hash = await bcrypt.hash(password, 10);
  console.log(`Password: ${password}`);
  console.log(`Hash: ${hash}`);
}

generateHash();

