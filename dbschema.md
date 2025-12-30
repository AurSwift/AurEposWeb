-- Main SaaS Platform Database
CREATE DATABASE epos_central;

-- Core Tables for SaaS Operations
CREATE TABLE customers (
id UUID PRIMARY KEY,
company_name VARCHAR(255),
email VARCHAR(255) UNIQUE,
billing_address JSONB,
tax_id VARCHAR(50),
created_at TIMESTAMPTZ DEFAULT NOW(),
status VARCHAR(20) -- 'active', 'suspended', 'cancelled'
);

CREATE TABLE subscriptions (
id UUID PRIMARY KEY,
customer_id UUID REFERENCES customers(id),
plan_type VARCHAR(20), -- 'basic', 'professional', 'enterprise'
billing_cycle VARCHAR(10), -- 'monthly', 'annual'
price DECIMAL(10,2),
status VARCHAR(20), -- 'active', 'past_due', 'cancelled'
current_period_start TIMESTAMPTZ,
current_period_end TIMESTAMPTZ,
auto_renew BOOLEAN DEFAULT true
);

CREATE TABLE license_keys (
id UUID PRIMARY KEY,
customer_id UUID REFERENCES customers(id),
subscription_id UUID REFERENCES subscriptions(id),
license_key VARCHAR(50) UNIQUE,
max_terminals INTEGER DEFAULT 1,
activation_count INTEGER DEFAULT 0,
created_at TIMESTAMPTZ DEFAULT NOW(),
is_active BOOLEAN DEFAULT true
);

CREATE TABLE activations (
id UUID PRIMARY KEY,
license_key VARCHAR(50) REFERENCES license_keys(license_key),
machine_id_hash VARCHAR(128), -- Hashed machine fingerprint
terminal_name VARCHAR(100),
first_activation TIMESTAMPTZ DEFAULT NOW(),
last_heartbeat TIMESTAMPTZ,
is_active BOOLEAN DEFAULT true,
ip_address INET,
location JSONB -- city, country from IP
);

CREATE TABLE payments (
id UUID PRIMARY KEY,
customer_id UUID REFERENCES customers(id),
amount DECIMAL(10,2),
currency VARCHAR(3) DEFAULT 'USD',
status VARCHAR(20),
stripe_payment_id VARCHAR(100),
invoice_url TEXT,
paid_at TIMESTAMPTZ
);
