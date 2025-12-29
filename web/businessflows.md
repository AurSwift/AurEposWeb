# **EPOS Software as a Service (SaaS) Platform: Business Rules & Implementation Flow**

## **1. Core Business Model & Definitions**

### **Business Rules**

1. **Subscription-Based Access**: Software is licensed, not sold. Access is granted via active subscriptions.
2. **Tiered Pricing Structure**:
   - **Basic**: Single terminal, basic inventory & sales
   - **Professional**: Multi-terminal, advanced reporting, inventory management
   - **Enterprise**: Unlimited terminals, API access, custom integrations, priority support
3. **Billing Cycles**: Monthly/Annual (with 15-20% discount for annual)
4. **License Keys**: Unique alphanumeric codes that activate software features based on subscription tier
5. **Usage Limits**: Enforced per plan (terminals, users, storage, features)

### **Key Entities**

- **Customer Account**: Organization/person paying for subscriptions
- **End User**: Individual using the EPOS software
- **Subscription Plan**: Tier with specific features/limits
- **License Key**: Activation code tied to subscription
- **Terminal/Device**: Installation instance
- **Billing Profile**: Payment information

---

## **2. Subscription & Licensing Flow**

### **A. Customer Registration & Plan Selection**

```
1. Customer signs up on website
2. Selects subscription plan (Basic/Pro/Enterprise)
3. Chooses billing cycle (monthly/annual)
4. Enters payment information
5. System creates:
   - Customer account
   - Initial subscription (status: "pending_activation")
   - Generates master license key
   - Sets billing cycle start date
```

### **B. License Key Generation Rules**

```javascript
// Example license key structure
Format: EPOS-{PlanCode}-{Random8Char}-{Checksum}
Example: EPOS-PRO-7A83B2D4-E9

Business Rules:
1. Each subscription generates ONE master license key
2. Master key can activate multiple terminals up to plan limit
3. Keys expire immediately on subscription cancellation
4. Keys are regenerated on plan upgrade/downgrade
5. Each terminal gets unique installation ID paired with license
```

### **C. Activation & Validation Flow**

```
User Side:
1. User downloads EPOS software
2. Launches application, enters license key
3. Software contacts activation server
4. Server validates:
   - Key exists and is active
   - Subscription is paid and current
   - Plan has available terminal slots
   - Key matches software version
5. If valid:
   - Returns activation token
   - Creates terminal record
   - Decrements available terminal count
   - Starts 24-hour revalidation timer
```

---

## **3. Subscription Management Rules**

### **A. Payment & Renewal Rules**

1. **Auto-Renewal**: Enabled by default, 3 email reminders before charge
2. **Grace Period**: 7 days after failed payment before suspension
3. **Suspension**:
   - Software enters "read-only" mode after grace period
   - Data preserved for 90 days post-suspension
4. **Cancellation**:
   - Immediate access termination on request
   - Pro-rated refunds for annual plans only (< 30 days)
5. **Plan Changes**:
   - Upgrade: Immediate, pro-rated charge
   - Downgrade: Effective next billing cycle

### **B. Usage Monitoring & Enforcement**

```sql
-- Example tracking table
CREATE TABLE terminal_activations (
    activation_id UUID PRIMARY KEY,
    license_key VARCHAR(50),
    device_fingerprint TEXT,
    ip_address INET,
    first_activation TIMESTAMP,
    last_check_in TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    terminal_count INT DEFAULT 1
);

-- Business Rules:
-- 1. Maximum 5 activation attempts per hour
-- 2. Device fingerprinting to prevent key sharing
-- 3. Daily "heartbeat" to validate active terminals
-- 4. Automatic deactivation after 7 days of no heartbeat
```

---

## **4. Technical Implementation Architecture**

### **A. System Components**

```
1. **Web Portal** (Next.js/React)
   - Marketing pages
   - Account management
   - Subscription handling (Stripe integration)
   - License key display
   - Usage analytics dashboard

2. **License Management API** (Node.js/Python)
   - Key generation/validation
   - Activation endpoints
   - Usage tracking
   - Webhook handlers (payment events)

3. **Database Schema**
   - customers (id, email, company, billing_id)
   - subscriptions (id, customer_id, plan, status, current_period_end)
   - license_keys (id, key, subscription_id, max_terminals, is_active)
   - activations (id, license_key, device_hash, last_ping, is_active)

4. **EPOS Client Software**
   - Embedded license validation module
   - Periodic check-in (every 24 hours)
   - Graceful degradation when license invalid
```

### **B. Activation Sequence Diagram**

```
Client App           License Server          Payment Processor
    |                       |                       |
    |-- Enter License Key -->|                       |
    |                       |-- Validate Key & Sub -->|
    |                       |<-- Subscription Status--|
    |                       |-- Check Available Slot->|
    |<-- Activation Token --|                       |
    |-- Periodic Heartbeat->|                       |
    |                       |-- Log Activity ------->|
```

---

## **5. Customer Journey & User Flows**

### **A. New Customer Flow**

```
1. Landing Page → View Pricing → Select Plan
2. Create Account → Enter Payment Details
3. Payment Processing (Stripe/Paddle)
4. Success Page with:
   - Download link for software
   - License key displayed
   - Activation instructions
   - Welcome email sent (with key)
5. Download & Install → Activate → Use
```

### **B. Existing Customer Portal Features**

```
Dashboard Shows:
- Current plan & renewal date
- License key (with copy button)
- Active terminals count/max
- Usage statistics
- Billing history
- Plan upgrade options
- Team management (for multi-user)

Actions Available:
- Update payment method
- Download software updates
- Deactivate specific terminals
- View activation history
- Export invoices
- Submit support tickets
```

---

## **6. Security & Anti-Piracy Measures**

### **Business Rules for License Protection**

1. **Key Binding**: License binds to device fingerprint (CPU+HDD+MAC)
2. **Activation Limits**:
   - Max 3 device changes per month
   - Manual approval required beyond limit
3. **Offline Tolerance**:
   - Software works 14 days without internet
   - Requires re-validation after period
4. **Abuse Detection**:
   - Multiple IPs using same key → flag for review
   - Rapid activation/deactivation → temporary lock
5. **Revocation Rights**: Reserved for Terms of Service violations

### **Implementation Details**

```python
# Example validation logic
def validate_license(key, device_fingerprint):
    # Check subscription status
    subscription = get_subscription_by_key(key)

    if not subscription.is_active:
        return {"valid": False, "reason": "subscription_inactive"}

    # Check terminal limits
    active_terminals = get_active_terminals(key)
    if active_terminals >= subscription.max_terminals:
        return {"valid": False, "reason": "terminal_limit_reached"}

    # Check for suspicious activity
    if detect_abuse(key, device_fingerprint):
        return {"valid": False, "reason": "suspicious_activity"}

    # Generate time-limited token
    token = generate_auth_token(key, device_fingerprint, expires_in=24h)

    return {"valid": True, "token": token, "plan": subscription.plan}
```

---

## **7. Billing & Revenue Operations**

### **Revenue Recognition Rules**

1. **Monthly Plans**: Recognize revenue evenly over month
2. **Annual Plans**: Recognize monthly (1/12 each month)
3. **Setup Fees**: One-time, recognized immediately
4. **Overages**: Additional terminals billed pro-rated

### **Dunning Process (Failed Payments)**

```
Day 0: Payment fails
Day 1: Automatic retry
Day 2: Email notification
Day 4: Final warning email
Day 7: Subscription suspended
Day 30: Data scheduled for deletion
Day 45: Account deactivated
```

---

## **8. Implementation Timeline & Phases**

### **Phase 1: MVP (Weeks 1-4)**

- Basic subscription plans (monthly only)
- Manual license key generation
- Simple activation validation
- Stripe integration for payments
- Customer portal (basic)

### **Phase 2: Enhanced (Weeks 5-8)**

- Annual billing options
- Automated key management
- Device fingerprinting
- Usage analytics dashboard
- Email automation for billing

### **Phase 3: Advanced (Weeks 9-12)**

- Offline activation tokens
- API for bulk deployments
- Reseller/wholesale portal
- Advanced abuse detection
- SLA monitoring

---

## **9. Key Metrics & Monitoring**

### **Business Metrics to Track**

1. **MRR/ARR**: Monthly/Annual Recurring Revenue
2. **Churn Rate**: Cancellations per month
3. **Activation Rate**: % of keys activated
4. **Conversion Rate**: Trial to paid
5. **LTV**: Customer Lifetime Value
6. **CAC**: Customer Acquisition Cost

### **Technical Monitoring**

- Activation success/failure rates
- API response times
- Concurrent active terminals
- Payment success rates
- Support ticket volume

---

## **10. Support & Compliance Considerations**

### **Customer Support Rules**

1. **Support Tiers**:
   - Basic: Email only, 48hr response
   - Professional: Email + chat, 24hr response
   - Enterprise: Phone priority, 4hr response
2. **License Transfers**: Allowed with approval (business sale)
3. **Data Export**: Available on cancellation request

### **Legal & Compliance**

- Terms of Service specifying license terms
- GDPR/Data protection compliance
- Payment Card Industry (PCI) compliance
- Export controls (if international)
- Right-to-audit clause for enterprise

---

## **Implementation Recommendations**

### **Recommended Tech Stack**

- **Frontend**: Next.js + Tailwind CSS
- **Backend**: Node.js/Express or Python/FastAPI
- **Database**: PostgreSQL with Redis cache
- **Payments**: Stripe or Paddle (handles VAT)
- **Email**: SendGrid or Resend
- **Hosting**: AWS/Azure with Docker containers

### **Critical Success Factors**

1. **Seamless Activation**: Users should be running in <10 minutes
2. **Transparent Billing**: Clear invoices, easy upgrades
3. **Reliable Validation**: Minimal false positives
4. **Graceful Degradation**: Software should still function during brief outages
5. **Scalable Architecture**: Handle thousands of concurrent validations

This system balances user experience with business protection, ensuring legitimate customers have uninterrupted access while preventing revenue leakage through piracy or unauthorized sharing. The key is making the licensing "invisible" to paying customers while creating significant friction for unauthorized users.
