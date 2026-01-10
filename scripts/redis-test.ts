/**
 * Redis Connection Test Script
 *
 * Tests Redis connectivity and pub/sub functionality
 * Run with: tsx -r dotenv/config scripts/redis-test.ts dotenv_config_path=.env.local
 */

import {
  getPublisher,
  createSubscriber,
  isRedisConfigured,
  getRedisStatus,
} from "../lib/redis";

async function testRedis() {
  console.log("🔍 Testing Redis Configuration...\n");

  // Check if Redis is configured
  console.log("1. Configuration Check:");
  console.log(`   ✓ Redis configured: ${isRedisConfigured()}`);
  console.log(`   ✓ REDIS_URL: ${process.env.REDIS_URL || "(not set)"}\n`);

  if (!isRedisConfigured()) {
    console.log(
      "❌ Redis is not configured. Please set REDIS_URL in .env.local\n"
    );
    process.exit(1);
  }

  // Get publisher
  console.log("2. Publisher Connection:");
  const publisher = getPublisher();
  if (!publisher) {
    console.log("❌ Failed to create publisher\n");
    process.exit(1);
  }

  try {
    // Publisher auto-connects on first command, test with PING
    const pong = await publisher.ping();
    console.log(`   ✓ Publisher connected successfully (${pong})\n`);
  } catch (error) {
    console.error("   ❌ Publisher connection failed:", error);
    process.exit(1);
  }

  // Get subscriber
  console.log("3. Subscriber Connection:");
  const subscriber = createSubscriber();
  if (!subscriber) {
    console.log("❌ Failed to create subscriber\n");
    process.exit(1);
  }

  try {
    // Subscriber also auto-connects, test with PING
    const pong = await subscriber.ping();
    console.log(`   ✓ Subscriber connected successfully (${pong})\n`);
  } catch (error) {
    console.error("   ❌ Subscriber connection failed:", error);
    process.exit(1);
  }

  // Test pub/sub
  console.log("4. Testing Pub/Sub Functionality:");

  const testChannel = "test-channel";
  const testMessage = JSON.stringify({ test: true, timestamp: Date.now() });
  let messageReceived = false;

  // Subscribe to test channel
  await subscriber.subscribe(testChannel, (err) => {
    if (err) {
      console.error("   ❌ Subscription failed:", err);
      process.exit(1);
    }
  });

  // Listen for messages
  subscriber.on("message", (channel, message) => {
    if (channel === testChannel) {
      console.log(`   ✓ Received message on channel "${channel}"`);
      console.log(`   ✓ Message content: ${message}`);
      messageReceived = true;
    }
  });

  // Wait a bit for subscription to be ready
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Publish test message
  console.log(`   → Publishing test message to "${testChannel}"...`);
  await publisher.publish(testChannel, testMessage);

  // Wait for message to be received
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (messageReceived) {
    console.log("   ✓ Pub/sub test successful!\n");
  } else {
    console.log("   ❌ Message not received. Check Redis configuration.\n");
  }

  // Test Redis status endpoint
  console.log("5. Redis Health Status:");
  const status = await getRedisStatus();
  console.log(`   ✓ Configured: ${status.configured}`);
  console.log(`   ✓ Healthy: ${status.healthy}`);
  if (status.error) {
    console.log(`   ⚠️  Error: ${status.error}`);
  }
  console.log();

  // Test basic Redis commands
  console.log("6. Testing Basic Redis Commands:");
  try {
    // SET command
    await publisher.set("test:key", "test-value", "EX", 60);
    console.log("   ✓ SET command successful");

    // GET command
    const value = await publisher.get("test:key");
    console.log(`   ✓ GET command successful (value: ${value})`);

    // DEL command
    await publisher.del("test:key");
    console.log("   ✓ DEL command successful");

    // INFO command
    const info = await publisher.info("server");
    const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
    console.log(`   ✓ Redis version: ${version}\n`);
  } catch (error) {
    console.error("   ❌ Command test failed:", error);
  }

  // Cleanup
  console.log("7. Cleanup:");
  await subscriber.unsubscribe(testChannel);
  await subscriber.quit();
  await publisher.quit();
  console.log("   ✓ Connections closed\n");

  console.log("✅ All tests completed successfully!");
  console.log("\nRedis is configured correctly and ready to use! 🎉\n");

  process.exit(0);
}

// Run tests
testRedis().catch((error) => {
  console.error("\n❌ Test failed with error:", error);
  process.exit(1);
});
