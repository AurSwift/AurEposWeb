# **Activation & License Key Business Logic for Local EPOS Software**

## **1. Unique Machine Identification Strategy**

### **Machine Fingerprinting Components**

```
Primary Identifiers (Combined Hash):
├── Hardware
│   ├── CPU ID/Serial (via WMI/System Management)
│   ├── Motherboard Serial
│   ├── Disk Drive Serial(s)
│   ├── MAC Address (primary network adapter)
│   └── BIOS UUID
├── Software
│   ├── Windows Product ID / Machine GUID
│   ├── .NET Machine Key (if applicable)
│   └── Custom installation signature
└── Derived
    ├── System locale/region settings
    ├── Installed .NET frameworks
    └── Directory structure hash
```

### **Business Rules for Machine ID Generation**

1. **Multi-factor Identification**: Minimum 3 hardware identifiers required
2. **Fallback Hierarchy**: If primary IDs unavailable, use secondary with increased security checks
3. **Consistency Check**: Store fingerprint on first activation; validate consistency on subsequent checks
4. **Graceful Degradation**: Allow minor hardware changes (single component) with user verification

### **Implementation Example (C#/.NET)**

```csharp
public class MachineFingerprint
{
    public string GenerateStableId()
    {
        List<string> identifiers = new List<string>();

        // Primary identifiers (preferred)
        identifiers.Add(GetCpuId());
        identifiers.Add(GetBaseboardSerial());
        identifiers.Add(GetDiskSerial());

        // Secondary (if primary missing)
        if (identifiers.Count < 3)
        {
            identifiers.Add(GetMacAddress());
            identifiers.Add(GetBiosSerial());
        }

        // Create composite hash
        string composite = string.Join("|", identifiers.Where(id => !string.IsNullOrEmpty(id)));
        string machineId = ComputeHash(composite + GetSystemSalt());

        // Add versioning for future updates
        return $"V2-{machineId}";
    }

    private string ComputeHash(string input)
    {
        using (SHA256 sha256 = SHA256.Create())
        {
            byte[] hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(input));
            return BitConverter.ToString(hash).Replace("-", "").Substring(0, 16);
        }
    }
}
```

## **2. License Key Structure & Generation Rules**

### **License Key Format**

```
Format: [Product]-[Type]-[Version]-[Unique]-[Checksum]
Example: EPOS-PRO-V2-7A83B2D4-E9

Components:
1. Product Code (EPOS) - 4 chars
2. Plan Type (PRO/BAS/ENT) - 3 chars
3. Version (V2) - 2 chars
4. Unique ID (8 chars) - Random secure string
5. Checksum (2 chars) - Validation code
```

### **Business Rules for Key Generation**

```csharp
public class LicenseGenerator
{
    // Rule 1: Server-side generation only
    public string GenerateLicenseKey(string product, string plan, int customerId)
    {
        // Rule 2: Include customer ID in seed
        string seed = $"{customerId}-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid()}";

        // Rule 3: Use cryptographically secure random for unique portion
        string uniquePart = GenerateSecureRandomString(8);

        // Rule 4: Create checksum based on all components
        string baseKey = $"{product}-{plan}-V2-{uniquePart}";
        string checksum = CalculateChecksum(baseKey);

        string licenseKey = $"{baseKey}-{checksum}";

        // Rule 5: Store in database with metadata
        StoreLicenseInDatabase(licenseKey, customerId, plan, DateTime.UtcNow);

        return licenseKey;
    }

    // Rule 6: Validate format before processing
    public bool ValidateFormat(string licenseKey)
    {
        Regex pattern = new Regex(@"^EPOS-(BAS|PRO|ENT)-V[0-9]-[A-Z0-9]{8}-[A-Z0-9]{2}$");
        return pattern.IsMatch(licenseKey);
    }
}
```

## **3. Activation Flow & Validation Rules**

### **Initial Activation Process**

```
CLIENT SOFTWARE (Local EPOS)              LICENSE SERVER
1. Collect machine fingerprint
   → CPU ID, Disk Serial, etc.
2. Generate machine ID hash
3. Send activation request:
   {
     "license_key": "EPOS-PRO-V2-7A83B2D4-E9",
     "machine_fingerprint": "V2-A1B2C3D4E5F67890",
     "timestamp": "2024-01-15T10:30:00Z"
   }
                                  ↓
4. Validate license key format
5. Check subscription status (active/paid)
6. Verify this is FIRST activation
   → No existing machine ID for this key
                                  ↓
7. Generate activation token:
   {
     "token": "eyJ...",
     "expires": "2024-02-15T10:30:00Z",
     "plan": "PRO",
     "features": ["multi_terminal", "advanced_reporting"]
   }
8. Store activation record:
   - License Key
   - Machine ID Hash
   - Activation Timestamp
   - IP Address
   - Client Version
                                  ↓
9. Return success + token
10. Store token securely in local config
11. Begin periodic validation (every 24h)
```

### **Business Rules for Activation**

1. **Single Activation Rule**: One license key = One machine ID binding (for single-seat licenses)
2. **First-Use Binding**: First successful activation permanently binds key to machine ID
3. **No Transfer Policy**: Cannot be moved to another machine without explicit deactivation
4. **Graceful Failure**: Software continues working for 7 days if validation fails, then limits functionality
5. **Deactivation Count**: Maximum 3 deactivations per year per license key

### **Server-Side Activation Validation Code**

```csharp
public class ActivationValidator
{
    public ActivationResult ValidateActivation(ActivationRequest request)
    {
        // Rule 1: Validate license key exists and is active
        var license = _dbContext.Licenses
            .FirstOrDefault(l => l.Key == request.LicenseKey
                              && l.Status == LicenseStatus.Active);

        if (license == null)
            return ActivationResult.Failed("Invalid or inactive license");

        // Rule 2: Check subscription is paid
        var subscription = _dbContext.Subscriptions
            .FirstOrDefault(s => s.Id == license.SubscriptionId
                              && s.IsActive);

        if (subscription == null)
            return ActivationResult.Failed("No active subscription");

        // Rule 3: Check if this key is already activated
        var existingActivation = _dbContext.Activations
            .FirstOrDefault(a => a.LicenseKey == request.LicenseKey);

        // RULE 4: SINGLE MACHINE ENFORCEMENT
        if (existingActivation != null)
        {
            // Check if this is SAME machine (allow reactivation)
            if (existingActivation.MachineId == request.MachineFingerprint)
            {
                // Same machine - update last check-in
                existingActivation.LastCheckIn = DateTime.UtcNow;
                _dbContext.SaveChanges();

                return ActivationResult.Success(
                    existingActivation.Token,
                    existingActivation.Expires);
            }
            else
            {
                // DIFFERENT MACHINE - Check deactivation rules
                return HandleDifferentMachine(
                    existingActivation,
                    request,
                    license);
            }
        }

        // Rule 5: FIRST ACTIVATION - Create new record
        var activation = CreateNewActivation(request, license);
        _dbContext.Activations.Add(activation);
        _dbContext.SaveChanges();

        return ActivationResult.Success(activation.Token, activation.Expires);
    }

    private ActivationResult HandleDifferentMachine(
        Activation existingActivation,
        ActivationRequest newRequest,
        License license)
    {
        // Business Rule: Check if within grace period (24h of first activation)
        if ((DateTime.UtcNow - existingActivation.CreatedAt).TotalHours <= 24)
        {
            // Allow re-binding within grace period (user setting up new machine)
            existingActivation.MachineId = newRequest.MachineFingerprint;
            existingActivation.LastCheckIn = DateTime.UtcNow;
            _dbContext.SaveChanges();

            return ActivationResult.Success(
                existingActivation.Token,
                existingActivation.Expires);
        }

        // Business Rule: Check deactivation allowance
        var deactivationCount = _dbContext.Deactivations
            .Count(d => d.LicenseKey == license.Key
                     && d.CreatedAt > DateTime.UtcNow.AddYears(-1));

        if (deactivationCount >= 3)
        {
            return ActivationResult.Failed(
                "Maximum device transfers reached. Contact support.");
        }

        // Requires explicit deactivation via customer portal
        return ActivationResult.Failed(
            "License already activated on another device. " +
            "Deactivate from your account portal first.");
    }
}
```

## **4. Local Validation & Anti-Tampering Measures**

### **Client-Side Protection Rules**

```csharp
public class LocalLicenseValidator
{
    // Rule 1: Store activation data in multiple locations
    private readonly string[] _storagePaths = {
        @"%ProgramData%\EPOS\license.dat",
        @"HKEY_CURRENT_USER\Software\EPOS\License",
        @"%AppData%\EPOS\config\activation.bin"
    };

    // Rule 2: Encrypt local activation data
    public void StoreActivationData(LicenseData data, string machineId)
    {
        // Combine activation token with machine ID
        string combined = $"{data.Token}|{machineId}|{data.Expires}";

        // Encrypt with machine-specific key
        byte[] encrypted = EncryptWithMachineKey(combined);

        // Store in multiple locations with different obfuscation
        foreach (var path in _storagePaths)
        {
            StoreWithObfuscation(path, encrypted, GetPathSpecificSalt(path));
        }

        // Rule 3: Create integrity checks
        CreateIntegrityChecks(data.Token);
    }

    // Rule 4: Validate on each application start
    public ValidationResult ValidateOnStartup()
    {
        // Step 1: Verify machine fingerprint hasn't changed
        string currentMachineId = _fingerprint.GenerateStableId();
        string storedMachineId = RetrieveStoredMachineId();

        if (currentMachineId != storedMachineId)
        {
            // Check if it's a minor hardware change (allow 1 component difference)
            if (!IsMinorHardwareChange(currentMachineId, storedMachineId))
            {
                return ValidationResult.Invalid("Machine changed - reactivation required");
            }
        }

        // Step 2: Check token expiration
        DateTime expiration = GetTokenExpiration();
        if (DateTime.UtcNow > expiration)
        {
            // Attempt online validation
            return AttemptOnlineValidation();
        }

        // Step 3: Verify integrity of local files
        if (!VerifyIntegrityChecks())
        {
            return ValidationResult.Tampered("License files modified");
        }

        // Step 4: Check for clock tampering
        if (DetectClockRollback())
        {
            return ValidationResult.Tampered("System clock modified");
        }

        return ValidationResult.Valid();
    }

    // Rule 5: Detect debugging/proxy attempts
    private bool IsDebuggingEnvironment()
    {
        // Check for debugger attached
        if (System.Diagnostics.Debugger.IsAttached)
            return true;

        // Check for common reverse engineering tools
        string[] suspiciousProcesses = { "ollydbg", "x64dbg", "ida", "wireshark", "fiddler" };
        var processes = Process.GetProcesses()
            .Select(p => p.ProcessName.ToLower());

        return processes.Any(p => suspiciousProcesses.Any(sp => p.Contains(sp)));
    }
}
```

## **5. Periodic Validation & Heartbeat System**

### **Heartbeat Business Rules**

```csharp
public class HeartbeatService
{
    // Rule 1: Send heartbeat every 24 hours minimum
    // Rule 2: Randomize interval (20-28 hours) to prevent pattern detection
    // Rule 3: Include multiple validation factors in heartbeat

    public async Task<HeartbeatResult> SendHeartbeatAsync()
    {
        var heartbeatData = new HeartbeatRequest
        {
            LicenseKey = GetLicenseKey(),
            MachineId = GetMachineFingerprint(),
            ClientVersion = GetClientVersion(),
            Timestamp = DateTime.UtcNow,

            // Rule 4: Include usage statistics (for analytics)
            SessionCount = GetSessionCount(),
            TransactionCount = GetTransactionCount(),
            LastBackupDate = GetLastBackupDate(),

            // Rule 5: Include system integrity checks
            IntegrityHash = ComputeSystemIntegrityHash(),

            // Rule 6: Encrypt sensitive data
            EncryptedData = EncryptLocalBusinessData()
        };

        // Rule 7: Implement retry logic with exponential backoff
        for (int attempt = 1; attempt <= 3; attempt++)
        {
            try
            {
                var response = await _httpClient.PostAsync(
                    "/api/v1/license/heartbeat",
                    heartbeatData);

                if (response.IsSuccessStatusCode)
                {
                    var result = await ParseResponse(response);

                    // Rule 8: Update local expiration based on server response
                    UpdateLocalExpiration(result.NewExpiration);

                    // Rule 9: Process any feature flag updates
                    UpdateFeatures(result.FeatureFlags);

                    return HeartbeatResult.Success();
                }

                await Task.Delay(1000 * (int)Math.Pow(2, attempt));
            }
            catch
            {
                // Continue to retry
            }
        }

        // Rule 10: If all retries fail, enter grace period
        EnterGracePeriod();
        return HeartbeatResult.Offline();
    }

    // Rule 11: Grace period logic (7 days offline operation)
    private void EnterGracePeriod()
    {
        DateTime lastSuccessfulHeartbeat = GetLastSuccessfulHeartbeat();
        DateTime gracePeriodEnd = lastSuccessfulHeartbeat.AddDays(7);

        if (DateTime.UtcNow > gracePeriodEnd)
        {
            // Switch to limited functionality mode
            EnableLimitedFunctionality();

            // Show persistent notification to user
            ShowReactivationRequired();
        }
    }
}
```

## **6. Anti-Piracy & Tampering Detection Rules**

### **Multi-Layer Protection System**

```csharp
public class AntiTamperSystem
{
    // LAYER 1: Runtime Protection
    public void InitializeRuntimeProtection()
    {
        // Hook critical methods
        HookLicenseValidationMethods();

        // Encrypt strings in memory
        EnableStringEncryption();

        // Detect debuggers
        EnableDebuggerDetection();
    }

    // LAYER 2: Code Integrity
    public bool VerifyCodeIntegrity()
    {
        // Calculate hash of critical assemblies
        string currentHash = CalculateAssemblyHash("EPOS.Core.dll");
        string expectedHash = GetExpectedHash();

        if (currentHash != expectedHash)
        {
            LogTamperingAttempt("Assembly modified");
            return false;
        }

        // Check for IL modifications
        if (DetectIlModifications())
        {
            LogTamperingAttempt("IL code modified");
            return false;
        }

        return true;
    }

    // LAYER 3: Behavioral Analysis
    public void MonitorLicenseUsage()
    {
        // Track validation patterns
        var validationPattern = new ValidationPattern
        {
            Frequency = CountValidationsPerHour(),
            TimeOfDay = GetValidationTimes(),
            SuccessRate = GetValidationSuccessRate()
        };

        // Detect suspicious patterns
        if (IsSuspiciousPattern(validationPattern))
        {
            // Trigger silent alarm to server
            ReportSuspiciousActivity(validationPattern);

            // Gradually degrade functionality
            IntroduceRandomLatency();
            DisablePremiumFeatures();
        }
    }

    // LAYER 4: Environmental Checks
    public bool CheckEnvironment()
    {
        // Verify not running in VM (unless allowed)
        if (IsRunningInVirtualMachine() && !IsVmAllowed())
        {
            return false;
        }

        // Check for sandbox environments
        if (IsSandboxed())
        {
            return false;
        }

        // Verify system time hasn't been rolled back
        if (HasSystemTimeBeenAdjusted())
        {
            return false;
        }

        return true;
    }
}
```

## **7. Deactivation & Transfer Rules**

### **Customer-Initiated Deactivation Process**

```
BUSINESS RULES FOR DEACTIVATION:

1. Deactivation Portal Access:
   - Only account owner can initiate
   - Requires re-authentication
   - Available once per 30 days (for single-seat)

2. Deactivation Types:
   a) Standard Deactivation (for hardware upgrade):
      - Current machine immediately deactivated
      - License available for reactivation
      - Counts against annual limit (max 3)

   b) Emergency Deactivation (hardware failure):
      - Requires support ticket
      - Doesn't count against limit
      - 24-48 hour verification period

   c) Permanent Transfer (business sale):
      - Requires legal documentation
      - Transfers all license history
      - New owner must accept terms

3. Deactivation Implementation:
```

```csharp
public class DeactivationService
{
    public DeactivationResult ProcessDeactivation(
        string licenseKey,
        string reason,
        string initiatedBy)
    {
        // Rule 1: Verify ownership
        if (!VerifyOwnership(licenseKey, initiatedBy))
            return DeactivationResult.Failed("Not authorized");

        // Rule 2: Check deactivation limits
        if (!CanDeactivate(licenseKey))
            return DeactivationResult.Failed("Deactivation limit reached");

        // Rule 3: Get current activation
        var activation = GetCurrentActivation(licenseKey);

        if (activation == null)
            return DeactivationResult.Failed("No active activation");

        // Rule 4: Create deactivation record
        var deactivation = new DeactivationRecord
        {
            LicenseKey = licenseKey,
            MachineId = activation.MachineId,
            Reason = reason,
            InitiatedBy = initiatedBy,
            InitiatedAt = DateTime.UtcNow,
            IpAddress = GetClientIp(),
            DeactivationId = GenerateDeactivationId()
        };

        // Rule 5: Invalidate current activation token
        InvalidateToken(activation.Token);

        // Rule 6: Send kill signal to client (if online)
        if (activation.LastSeen > DateTime.UtcNow.AddMinutes(-5))
        {
            SendKillSignal(activation.MachineId, deactivation.DeactivationId);
        }

        // Rule 7: Update license status
        UpdateLicenseStatus(licenseKey, LicenseStatus.Available);

        // Rule 8: Log for audit
        AuditLog.Deactivated(licenseKey, initiatedBy, reason);

        return DeactivationResult.Success(deactivation.DeactivationId);
    }

    // Rule 9: Kill signal forces immediate software shutdown
    private void SendKillSignal(string machineId, string deactivationId)
    {
        // Send encrypted shutdown command
        var killCommand = new KillCommand
        {
            Command = "SHUTDOWN",
            DeactivationId = deactivationId,
            Timestamp = DateTime.UtcNow,
            Signature = SignCommand()
        };

        // Client software checks for kill signals periodically
        QueueKillSignal(machineId, killCommand);
    }
}
```

## **8. Emergency Recovery & Exception Handling**

### **Business Rules for Exceptions**

```csharp
public class RecoveryService
{
    public RecoveryResult HandleActivationIssue(
        ActivationIssue issue,
        string licenseKey,
        string machineId)
    {
        // RULE 1: Hardware Change Grace Period
        if (issue.Type == IssueType.HardwareChanged)
        {
            // Allow if ≤ 2 components changed
            var oldMachineId = GetStoredMachineId(licenseKey);
            int changedComponents = CompareMachineIds(oldMachineId, machineId);

            if (changedComponents <= 2)
            {
                // Automatic allowance with verification
                return AllowWithVerification(licenseKey, machineId);
            }
        }

        // RULE 2: Disaster Recovery (fire/theft)
        if (issue.Type == IssueType.DisasterRecovery)
        {
            // Require proof of ownership
            if (VerifyDisasterRecovery(licenseKey))
            {
                // Reset activation count for this case
                ResetActivationCount(licenseKey);
                return RecoveryResult.AllowReactivate();
            }
        }

        // RULE 3: False Positive Handling
        if (issue.Type == IssueType.FalsePositive)
        {
            // Log incident and allow temporary activation
            LogFalsePositive(licenseKey, machineId, issue.Details);
            return RecoveryResult.TemporaryActivation(24);
        }

        // Default: Escalate to human review
        return RecoveryResult.EscalateToSupport();
    }
}
```

## **9. Audit & Compliance Logging**

### **Mandatory Audit Rules**

```csharp
public class AuditLogger
{
    // RULE: Log every license-related action
    public void LogLicenseAction(LicenseAction action)
    {
        var auditEntry = new AuditEntry
        {
            Timestamp = DateTime.UtcNow,
            LicenseKey = action.LicenseKey,
            Action = action.Type,
            MachineId = action.MachineId,
            IpAddress = action.IpAddress,
            UserAgent = action.UserAgent,
            Details = action.Details,

            // Cryptographic proof
            Hash = ComputeAuditHash(action),
            PreviousHash = GetPreviousHash(),

            // Compliance
            RetentionPeriod = 7 // years
        };

        // Store in write-once storage
        WriteAuditEntry(auditEntry);

        // Real-time alert for suspicious patterns
        CheckForSuspiciousPattern(auditEntry);
    }

    // RULE: Detect and alert on suspicious patterns
    private void CheckForSuspiciousPattern(AuditEntry entry)
    {
        var recentActions = GetRecentActions(entry.LicenseKey, TimeSpan.FromHours(24));

        // Pattern 1: Rapid activation attempts
        if (recentActions.Count(a => a.Action == "ACTIVATION_ATTEMPT") > 5)
        {
            AlertSecurityTeam("Rapid activation attempts", entry);
        }

        // Pattern 2: Multiple machine IDs
        var uniqueMachines = recentActions
            .Select(a => a.MachineId)
            .Distinct()
            .Count();

        if (uniqueMachines > 2)
        {
            AlertSecurityTeam("Multiple machine activations", entry);
        }
    }
}
```

## **10. Implementation Checklist**

### **Critical Security Measures**

- [ ] **Hardware Binding**: Machine fingerprint uses at least 3 stable identifiers
- [ ] **Encrypted Storage**: Activation data encrypted with machine-specific key
- [ ] **Anti-Debug**: Runtime detection of debugging/proxy tools
- [ ] **Code Signing**: All assemblies digitally signed and verified
- [ ] **Heartbeat System**: Regular validation with server
- [ ] **Grace Period**: Offline operation limited to 7 days
- [ ] **Deactivation Limits**: Max 3 transfers per year
- [ ] **Tamper Detection**: Multiple layers of integrity checking
- [ ] **Audit Trail**: Complete logging of all license actions
- [ ] **Kill Switch**: Remote deactivation capability

### **Customer Experience Considerations**

- [ ] Clear deactivation process via customer portal
- [ ] Graceful handling of hardware upgrades
- [ ] Emergency recovery process
- [ ] Offline operation capability
- [ ] Clear error messages for license issues
- [ ] Simple reactivation process for legitimate cases

This system enforces strict single-machine activation while providing legitimate customers with reasonable flexibility for hardware changes, all while maintaining strong anti-piracy measures through multi-layered protection and behavioral analysis.
