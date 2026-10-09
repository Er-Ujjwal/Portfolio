/**
 * Site-wide configuration.
 *
 * BIRTH_DATE powers the live "on earth for X years" counter in the hero.
 * Format: "YYYY-MM-DD". Set to null to hide the counter gracefully.
 */
export const BIRTH_DATE: string | null = "2004-06-18";

export const NAME = "Ujjwal Rauniyar";
export const QUOTE = "The more I know, I know how little I know.";
export const TAGS = ["SOFTWARE ENGINEER", "DSA", "AI/ML"] as const;

export const EMAIL = "mail.ujjwal18@gmail.com";
export const GITHUB_USERNAME = "Er-Ujjwal";
export const GITHUB_URL = "https://github.com/Er-Ujjwal";
export const LINKEDIN_URL = "https://linkedin.com/in/ujjwal-rauniyar";

/**
 * Visitor analytics is backed by Upstash Redis (see README "Visitor analytics
 * setup"). It needs UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
 * When they are missing, the visitors section degrades gracefully and shows
 * placeholder dashes instead of numbers — nothing is faked.
 */
