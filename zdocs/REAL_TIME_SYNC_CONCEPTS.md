# Real-Time Architecture & Concepts Guide

This guide explains the theoretical concepts, challenges, and solutions used in implementing real-time synchronization between a web server (Next.js) and a desktop application (Electron), specifically for payment and subscription events.

---

## 🏗 The Core Challenge: Stateless vs. Stateful

To understand why we implemented the solution the way we did, you must understand the environment our code runs in.

### 1. Stateful Servers (Traditional)
In a traditional Node.js/Express app running on a VPS (Virtual Private Server), the server is a **single, long-running process**.
- **Memory is shared:** If one user triggers an action, you can set a global variable or emit an event that other connected users can see immediately.
- **Connections are direct:** You can keep a list of active websocket connections in a javascript array.

### 2. Stateless / Serverless (Next.js & Vercel)
Modern frameworks like Next.js often run in a **Serverless** environment (like AWS Lambda or Vercel Functions).
- **Ephemeral:** When a request comes in (e.g., a Stripe Webhook), a tiny server "spins up," processes that ONE request, and then "dies" or effectively pauses.
- **Process Isolation:** The "process" handling the Webhook is completely different from the "process" holding the Desktop App's connection. They **cannot** talk to each other using shared memory or variables.

### 🛑 The "In-Memory" Problem
Your initial implementation likely used a Node.js `EventEmitter` or a global array to track liquid events.
- **Why it failed:** The Stripe Webhook fired on "Server Instance A". It emitted an event. But "Server Instance B" (where the user was listening) never heard it because they don't share memory.
- **The Result:** The desktop app never updated because the signal was lost in the void between processes.

---

## 🛠 Architectural Concepts

### 1. Server-Sent Events (SSE)
**What it is:** A standard HTTP connection where the server keeps the connection "open" and periodically pushes text data to the client.
- **Analogy:** Listening to a radio station. The station (server) keeps broadcasting, and your radio (client) just listens as long as it's tuned in.
- **Why use it?:** It's simpler than WebSockets for one-way communication (Server -> Client). It works over standard HTTP/HTTPS ports (443), making it friendly for corporate firewalls.

### 2. Webhooks
**What it is:** A mechanism where a service (Stripe) effectively "calls you" when something interesting happens.
- **Analogy:** Instead of you calling the post office every hour to check for mail ("Polling"), the postman comes to your house and rings your doorbell when mail arrives.
- **Process:** Stripe detects a payment -> Stripe sends a POST request to your `/api/stripe/webhooks` endpoint -> You process the data.

### 3. Polling (Database "Short" Poll)
**What it is:** The client (or server) repeatedly checks a resource at a set interval.
- **Context in our App:** Since we can't share memory, we use the **Database** as our shared "brain".
- **The Flow:**
    1.  **Webhook (Publisher):** Receives event -> Writes it to the Database (`subscription_event_logs`).
    2.  **SSE Endpoint (Subscriber):** Wakes up every 2 seconds -> Queries the Database ("Is there anything new?") -> Pushes data to client if yes.
- **Pros:** Extremely reliable. Works across all server types (Serverless, Docker, Clusters). Simple infrastructure (just Postgres).
- **Cons:** Slight delay (latency) equal to the polling interval (e.g., ~2 seconds lag).

### 4. Redis Pub/Sub (The "Instant" Option)
**What it is:** Redis is an in-memory data that supports a "Publish/Subscribe" pattern. It acts as a super-fast message broker outsite of your app.
- **Context:** You asked "What about Redis?". It solves the *Process Isolation* problem by being a shared, external message bus.
- **The Flow:**
    1.  **Webhook:** Receives event -> Publishes message to Redis channel `license:XYZ`.
    2.  **SSE Endpoint:** Connects and Subscribes to Redis channel `license:XYZ`.
    3.  **Redis:** Instantly forwards the message from Publisher to Subscriber.
- **Pros:** Real-time (Active pushes, sub-millisecond latency). No database load for polling.
- **Cons:** Adds infrastructure (NEED a Redis instance). Vercel/Serverless functions have limits on how long they can hold a Redis connection open. Connections limits.

---

## ⚖️ Comparison: Redis vs. Database Polling

| Feature | Database Polling (Current) | Redis Pub/Sub (Alternative) |
| :--- | :--- | :--- |
| **Latency** | ~2 seconds (Interval dependent) | < 100ms (Instant) |
| **Complexity** | Low (Uses existing DB) | Medium (Need Redis setup) |
| **Reliability** | High (Events persisted on disk) | High (If Redis is durable) |
| **Serverless Fit** | **Excellent** (Short queries) | **Harder** (Long-held connections) |
| **Cost** | Negligible (Standard queries) | Extra ($ for managed Redis) |

### Why we chose Database Polling first
For a desktop licensing app, a 2-second delay is acceptable. The user cancels on the web, and 2 seconds later their app locks. Database polling is "boring" technology—it just works, is easy to debug (you can see the rows in the table), and doesn't require maintaining a Redis cluster.

However, if you need **sub-second** updates (e.g., a stock trading app or multiplayer game), Redis is the standard choice.

---

## 📚 Dictionary of Terms

| Term | Definition |
|------|------------|
| **Latency** | The time delay between the cause (User pays) and the effect (Desktop app unlocks). |
| **Persistence** | Storing data in a way that survives process restarts (e.g., writing to PostgreSQL instead of a variable). |
| **Pub/Sub** | "Publish / Subscribe". A pattern where senders (publishers) send messages without knowing who will receive them (subscribers). |
| **Polling** | Repeatedly asking "Are we there yet?" |
| **Idempotency** | Handling the same event twice safely. (e.g., preventing double-charging). |

---

## 🚀 Summary of the Final Implementation

1.  **Event Source (Stripe):** Sends a payload (JSON) to your webhook URL.
2.  **Ingestion:** Your API verifies the signature, starts a **Database Transaction**.
3.  **Processing:** It updates permissions, revokes/grants licenses, and **Inserts a Log** into `subscription_event_logs`.
4.  **Distribution:** The desktop app, holding an open SSE connection, is managed by an API route that purely **reads from `subscription_event_logs`** every few seconds.
5.  **Result:** Updates happen reliably, regardless of server architecture, restarts, or crashes.
