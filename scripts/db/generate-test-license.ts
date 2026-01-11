/**
 * Quick script to generate a test license key
 * Run with: pnpm tsx scripts/generate-test-license.ts
 */

import { generateLicenseKey } from "../../lib/license/generator";

console.log("\n🔑 License Key Generator\n");
console.log("Basic Plan:        ", generateLicenseKey("basic", "test-customer"));
console.log("Professional Plan: ", generateLicenseKey("professional", "test-customer"));
console.log("\n✅ Copy any of the above keys to test in your desktop app!\n");
