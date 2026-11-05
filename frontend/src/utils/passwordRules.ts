// Password rules for accounts. They match the server's check, so a password
// that passes here will not be rejected when the account is created.
export interface PasswordRule {
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "An uppercase letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "A lowercase letter (a–z)", test: (p) => /[a-z]/.test(p) },
  { label: "A number (0–9)", test: (p) => /\d/.test(p) },
  {
    label: "A special character (e.g. ! @ # $ %)",
    test: (p) => /[!@#$%^&*()_+\-=[\]{}|;:'",.<>?/`~]/.test(p),
  },
];

/** Labels of the rules the password does not meet yet (empty when it is valid). */
export const unmetPasswordRules = (password: string): string[] =>
  PASSWORD_RULES.filter((rule) => !rule.test(password)).map((r) => r.label);
