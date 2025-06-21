const ViolationSeverity = {
  CRITICAL: 'critical',
  MODERATE: 'moderate',
  MINOR: 'minor'
};

const ViolationType = {
  NO_COOKIE_POLICY: 'no_cookie_policy',
  MISSING_CONSENT: 'missing_consent',
  SENSITIVE_DATA_COLLECTION: 'sensitive_data_collection',
  INCOMPLETE_POLICY: 'incomplete_policy',
  UNCLEAR_INFORMATION: 'unclear_information',
  MISSING_DETAILS: 'missing_details',
  EXCESSIVE_COOKIES: 'excessive_cookies',
  THIRD_PARTY_TRACKING: 'third_party_tracking'
};

const violationSeverityMap = {
  [ViolationType.NO_COOKIE_POLICY]: ViolationSeverity.CRITICAL,
  [ViolationType.SENSITIVE_DATA_COLLECTION]: ViolationSeverity.CRITICAL,
  [ViolationType.MISSING_CONSENT]: ViolationSeverity.MODERATE,
  [ViolationType.INCOMPLETE_POLICY]: ViolationSeverity.MODERATE,
  [ViolationType.EXCESSIVE_COOKIES]: ViolationSeverity.MODERATE,
  [ViolationType.THIRD_PARTY_TRACKING]: ViolationSeverity.MODERATE,
  [ViolationType.UNCLEAR_INFORMATION]: ViolationSeverity.MINOR,
  [ViolationType.MISSING_DETAILS]: ViolationSeverity.MINOR
};

// Schema cho violation object
const violationSchema = {
  id: 'string',
  type: 'ViolationType',
  severity: 'ViolationSeverity',
  message: 'string',
  description: 'string',
  recommendation: 'string',
  detected_at: 'timestamp'
};

export { ViolationSeverity, ViolationType, violationSeverityMap, violationSchema };
