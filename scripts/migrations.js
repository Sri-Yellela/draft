// Shared migration definitions — single source of truth for both server.js's boot-time
// migration runner and the standalone scripts/migration.js CLI runner.
// Additive-only: append new {id, sql} entries at the end; never edit or remove an applied one.
export const MIGRATIONS = [
    {
      id: "001_initial_schema",
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          is_admin INTEGER NOT NULL DEFAULT 0,
          apply_mode TEXT NOT NULL DEFAULT 'SIMPLE',
          apify_token TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS user_profile (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          full_name TEXT, email TEXT, phone TEXT,
          linkedin_url TEXT, github_url TEXT, location TEXT,
          address_line1 TEXT, address_line2 TEXT,
          city TEXT, state TEXT, zip TEXT, country TEXT DEFAULT 'United States',
          gender TEXT, ethnicity TEXT, veteran_status TEXT, disability_status TEXT,
          requires_sponsorship INTEGER NOT NULL DEFAULT 0,
          has_clearance INTEGER NOT NULL DEFAULT 0,
          clearance_level TEXT, visa_type TEXT, work_auth TEXT,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS job_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          search_query TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'combined',
          scraped_at INTEGER NOT NULL,
          jobs_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS resumes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          company TEXT NOT NULL,
          role TEXT NOT NULL,
          category TEXT,
          apply_mode TEXT NOT NULL DEFAULT 'SIMPLE',
          html TEXT NOT NULL,
          ats_score INTEGER,
          ats_report TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(user_id, job_id)
        );
        CREATE TABLE IF NOT EXISTS resume_versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          company TEXT NOT NULL,
          role TEXT NOT NULL,
          category TEXT,
          html TEXT NOT NULL,
          ats_score INTEGER,
          ats_report TEXT,
          version INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS base_resume (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          name TEXT,
          content TEXT NOT NULL,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS job_applications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          company TEXT NOT NULL,
          role TEXT NOT NULL,
          job_url TEXT,
          source TEXT,
          location TEXT,
          apply_mode TEXT,
          resume_file TEXT,
          applied_at INTEGER,
          notes TEXT,
          UNIQUE(user_id, job_id)
        );
        CREATE TABLE IF NOT EXISTS refresh_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          query TEXT NOT NULL,
          refreshed_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      id: "002_scraped_jobs_pool",
      sql: `
        CREATE TABLE IF NOT EXISTS scraped_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_id TEXT NOT NULL UNIQUE,
          search_query TEXT NOT NULL,
          company TEXT NOT NULL,
          title TEXT NOT NULL,
          category TEXT,
          location TEXT,
          work_type TEXT,
          source TEXT,
          url TEXT,
          posted_at TEXT,
          description TEXT,
          ghost_score INTEGER DEFAULT 0,
          years_experience INTEGER,
          is_frequent_repost INTEGER DEFAULT 0,
          _hash TEXT NOT NULL,
          scraped_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_query
          ON scraped_jobs(search_query, scraped_at);
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_hash
          ON scraped_jobs(_hash);
      `,
    },
    {
      id: "003_user_job_views",
      sql: `
        CREATE TABLE IF NOT EXISTS user_job_views (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          viewed_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(user_id, job_id)
        );
        CREATE INDEX IF NOT EXISTS idx_user_job_views_user
          ON user_job_views(user_id, job_id);
      `,
    },
    {
      id: "004_user_job_searches",
      sql: `
        CREATE TABLE IF NOT EXISTS user_job_searches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          search_query TEXT NOT NULL,
          last_scraped_at INTEGER,
          UNIQUE(user_id, search_query)
        );
      `,
    },
    {
      id: "005_scraped_jobs_new_columns",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN compensation TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN company_icon_url TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN source_platform TEXT;
        UPDATE scraped_jobs SET source_platform = LOWER(source) WHERE source IS NOT NULL;
      `,
    },
    {
      id: "006_user_jobs",
      sql: `
        CREATE TABLE IF NOT EXISTS user_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          visited INTEGER NOT NULL DEFAULT 0,
          applied INTEGER NOT NULL DEFAULT 0,
          starred INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(user_id, job_id)
        );
        CREATE INDEX IF NOT EXISTS idx_user_jobs_user ON user_jobs(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_jobs_job ON user_jobs(job_id);
        INSERT OR IGNORE INTO user_jobs (user_id, job_id, applied)
          SELECT user_id, job_id, 1 FROM job_applications;
      `,
    },
    {
      id: "007_scraped_jobs_v5_columns",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN apply_url TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN salary_min REAL;
        ALTER TABLE scraped_jobs ADD COLUMN salary_max REAL;
        ALTER TABLE scraped_jobs ADD COLUMN salary_currency TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN description_html TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN applicant_count INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN min_years_exp REAL;
        ALTER TABLE scraped_jobs ADD COLUMN max_years_exp REAL;
        ALTER TABLE scraped_jobs ADD COLUMN exp_raw TEXT;
      `,
    },
    {
      id: "008_disliked_and_linkedin_sessions",
      sql: `
        ALTER TABLE user_jobs ADD COLUMN disliked INTEGER NOT NULL DEFAULT 0;
        CREATE INDEX IF NOT EXISTS idx_user_jobs_disliked ON user_jobs(user_id, disliked);
        CREATE TABLE IF NOT EXISTS user_linkedin_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          cookies_enc TEXT NOT NULL,
          iv TEXT NOT NULL,
          auth_tag TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      id: "009_profile_name_split_and_pending",
      sql: `
        ALTER TABLE user_profile ADD COLUMN first_name TEXT;
        ALTER TABLE user_profile ADD COLUMN middle_name TEXT;
        ALTER TABLE user_profile ADD COLUMN last_name TEXT;
        ALTER TABLE user_profile ADD COLUMN name_suffix TEXT;
        ALTER TABLE user_jobs ADD COLUMN resume_generated INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      id: "010_apply_automation",
      sql: `
        ALTER TABLE job_applications ADD COLUMN auto_status TEXT;
        ALTER TABLE job_applications ADD COLUMN screenshot_path TEXT;
      `,
    },
    {
      id: "011_cleanup_log",
      sql: `
        CREATE TABLE IF NOT EXISTS cleanup_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_at INTEGER NOT NULL DEFAULT (unixepoch()),
          jobs_deleted INTEGER NOT NULL DEFAULT 0,
          orphans_cleaned INTEGER NOT NULL DEFAULT 0,
          details TEXT
        );
      `,
    },
    {
      id: "012_clear_all_dislikes",
      sql: `UPDATE user_jobs SET disliked = 0 WHERE disliked = 1;`,
    },
    {
      id: "013_employment_type",
      sql: `ALTER TABLE scraped_jobs ADD COLUMN employment_type TEXT;`,
    },
    {
      id: "admin_usage_events",
      sql: `
        CREATE TABLE IF NOT EXISTS usage_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          event_subtype TEXT,
          input_tokens INTEGER DEFAULT 0,
          output_tokens INTEGER DEFAULT 0,
          cache_read_tokens INTEGER DEFAULT 0,
          cache_creation_tokens INTEGER DEFAULT 0,
          cached INTEGER NOT NULL DEFAULT 0,
          model TEXT,
          cost_usd REAL DEFAULT 0,
          ats_score_before INTEGER,
          ats_score_after INTEGER,
          duration_ms INTEGER,
          job_id TEXT,
          company TEXT,
          success INTEGER NOT NULL DEFAULT 1,
          error_text TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_usage_events_user
          ON usage_events(user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_usage_events_type
          ON usage_events(event_type, created_at);
      `,
    },
    {
      id: "admin_user_limits",
      sql: `
        CREATE TABLE IF NOT EXISTS user_limits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          monthly_resumes INTEGER,
          monthly_ats_scores INTEGER,
          monthly_job_scrapes INTEGER,
          monthly_pdf_exports INTEGER,
          monthly_apply_runs INTEGER,
          monthly_token_budget INTEGER,
          daily_resumes INTEGER,
          daily_job_scrapes INTEGER,
          warning_threshold REAL DEFAULT 0.8,
          notes TEXT,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_by INTEGER REFERENCES users(id)
        );
      `,
    },
    {
      id: "admin_cache_events",
      sql: `
        CREATE TABLE IF NOT EXISTS cache_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          layer TEXT,
          domain_module TEXT,
          tokens_in_cache INTEGER DEFAULT 0,
          tokens_saved INTEGER DEFAULT 0,
          cost_saved_usd REAL DEFAULT 0,
          model TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_cache_events_user
          ON cache_events(user_id, created_at);
      `,
    },
    {
      id: "admin_scrape_events",
      sql: `
        CREATE TABLE IF NOT EXISTS scrape_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          search_query TEXT NOT NULL,
          raw_count INTEGER DEFAULT 0,
          filtered_count INTEGER DEFAULT 0,
          inserted_count INTEGER DEFAULT 0,
          duplicate_count INTEGER DEFAULT 0,
          ghost_count INTEGER DEFAULT 0,
          irrelevant_count INTEGER DEFAULT 0,
          duration_ms INTEGER,
          success INTEGER NOT NULL DEFAULT 1,
          error_text TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_scrape_events_user
          ON scrape_events(user_id, created_at);
      `,
    },
    {
      id: "ats_only_reports",
      sql: `
        CREATE TABLE IF NOT EXISTS ats_only_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          ats_report TEXT NOT NULL,
          ats_score INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(user_id, job_id)
        );
      `,
    },
    {
      id: "contact_messages",
      sql: `
        CREATE TABLE IF NOT EXISTS contact_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          subject TEXT,
          message TEXT NOT NULL,
          read INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    // ── Phase 2A: Domain profiles ──────────────────────────────
    {
      id: "013_domain_profiles",
      sql: `
        CREATE TABLE IF NOT EXISTS domain_profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          profile_name TEXT NOT NULL,
          role_family TEXT NOT NULL,
          domain TEXT NOT NULL,
          seniority TEXT NOT NULL DEFAULT 'mid',
          target_titles JSON NOT NULL DEFAULT '[]',
          selected_keywords JSON NOT NULL DEFAULT '[]',
          selected_verbs JSON NOT NULL DEFAULT '[]',
          selected_tools JSON NOT NULL DEFAULT '[]',
          is_active INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_domain_profiles_user
          ON domain_profiles(user_id, is_active);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_profiles_active
          ON domain_profiles(user_id) WHERE is_active = 1;
      `,
    },
    {
      id: "014_profile_onboarding_flag",
      sql: `
        ALTER TABLE users ADD COLUMN domain_profile_complete INTEGER NOT NULL DEFAULT 0;
      `,
    },
    // ── Phase 5A: Standalone users ─────────────────────────────
    {
      id: "015_standalone_users",
      sql: `
        CREATE TABLE IF NOT EXISTS standalone_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE,
          phone TEXT UNIQUE,
          google_id TEXT UNIQUE,
          display_name TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_seen_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS standalone_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          standalone_user_id INTEGER REFERENCES standalone_users(id) ON DELETE CASCADE,
          session_id TEXT,
          service TEXT NOT NULL,
          used_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_standalone_usage_user
          ON standalone_usage(standalone_user_id, service);
        CREATE INDEX IF NOT EXISTS idx_standalone_usage_session
          ON standalone_usage(session_id, service);
      `,
    },
    // ── Phase 6A: Profile-isolated job pools ──────────────────
    {
      id: "016_scraped_jobs_profile_tag",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN
          domain_profile_id INTEGER REFERENCES domain_profiles(id) ON DELETE SET NULL;
        ALTER TABLE user_jobs ADD COLUMN
          domain_profile_id INTEGER REFERENCES domain_profiles(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_profile
          ON scraped_jobs(domain_profile_id);
        CREATE INDEX IF NOT EXISTS idx_user_jobs_profile
          ON user_jobs(user_id, domain_profile_id);
      `,
    },
    // ── Phase 6B: ATS scoring at scrape time ──────────────────
    {
      id: "017_scraped_jobs_ats",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN ats_score INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN ats_report TEXT;
      `,
    },
    // ── Phase 6C: Resume Enhancer ────────────────────────────
    {
      id: "018_base_resume_enhance",
      sql: `
        ALTER TABLE base_resume ADD COLUMN enhanced_at INTEGER;
        ALTER TABLE base_resume ADD COLUMN enhanced_content TEXT;
        ALTER TABLE base_resume ADD COLUMN enhanced_ats_delta INTEGER;
        ALTER TABLE users ADD COLUMN enhance_used INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN enhance_paid INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      id: "019_notifications",
      sql: `
        CREATE TABLE IF NOT EXISTS notifications (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type       TEXT    NOT NULL,
          message    TEXT    NOT NULL,
          payload    TEXT,
          read       INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_user
          ON notifications(user_id, created_at);
      `,
    },
    {
      id: "020_dock_preferences",
      sql: `
        CREATE TABLE IF NOT EXISTS dock_preferences (
          user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          items_json TEXT    NOT NULL DEFAULT '["profile_switcher","notifications","quick_actions","settings","user_avatar"]',
          dock_enabled INTEGER NOT NULL DEFAULT 1,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    // ── Phase 7: Profile isolation backfill ──────────────────
    {
      id: "021_backfill_profile_tags",
      sql: `
        -- Disable foreign key enforcement for this migration
        -- The -1 sentinel approach violates the FK constraint
        -- on domain_profile_id. Use NULL instead of -1 for
        -- unmatched legacy rows and handle exclusion in queries.

        -- Best-effort tag: assign user_jobs rows to the user's
        -- active profile where one exists
        UPDATE user_jobs
        SET domain_profile_id = (
          SELECT dp.id
          FROM domain_profiles dp
          WHERE dp.user_id = user_jobs.user_id
            AND dp.is_active = 1
          LIMIT 1
        )
        WHERE domain_profile_id IS NULL;
      `
    },
    {
      id: "022_clear_legacy_user_jobs",
      sql: `
        -- Remove user_jobs rows that could not be matched
        -- to any domain profile (domain_profile_id still NULL
        -- after backfill means no active profile exists for
        -- that user — safe to clear, they will re-populate
        -- on next search with a profile set)
        DELETE FROM user_jobs
        WHERE domain_profile_id IS NULL
          AND job_id NOT IN (
            SELECT job_id FROM job_applications
          );
        -- Applied jobs are always protected regardless
      `
    },
    {
      id: "023_clean_wrong_profile_jobs",
      sql: `
        -- Keep only user_jobs that belong to a valid profile or are applied.
        -- Uses temp table to avoid correlated-subquery limitations in older SQLite.
        CREATE TEMP TABLE IF NOT EXISTS jobs_to_keep AS
          SELECT uj.rowid FROM user_jobs uj
          WHERE uj.domain_profile_id IN (
            SELECT id FROM domain_profiles WHERE user_id = uj.user_id
          )
          OR uj.job_id IN (SELECT job_id FROM job_applications);

        DELETE FROM user_jobs
        WHERE rowid NOT IN (SELECT rowid FROM jobs_to_keep);

        DROP TABLE IF EXISTS jobs_to_keep;
      `
    },
    {
      id: "024_clean_crossprofile_jobs",
      sql: `
        -- Remove user_jobs rows whose domain_profile_id belongs to a different user
        DELETE FROM user_jobs
        WHERE rowid IN (
          SELECT uj.rowid FROM user_jobs uj
          WHERE uj.domain_profile_id IS NOT NULL
            AND uj.domain_profile_id NOT IN (
              SELECT id FROM domain_profiles WHERE user_id = uj.user_id
            )
            AND uj.job_id NOT IN (
              SELECT job_id FROM job_applications WHERE user_id = uj.user_id
            )
        );

        -- Remove NULL-tagged rows that are not applied jobs
        DELETE FROM user_jobs
        WHERE domain_profile_id IS NULL
          AND job_id NOT IN (
            SELECT job_id FROM job_applications WHERE user_id = user_jobs.user_id
          );
      `
    },
    {
      id: "025_clean_wrong_profile_jobs",
      sql: `
        -- Remove user_jobs rows with NULL profile tag
        -- that are not applied jobs.
        -- These were inserted by the old search_query
        -- sync before this fix and will never match
        -- any profile filter.
        DELETE FROM user_jobs
        WHERE domain_profile_id IS NULL
        AND job_id NOT IN (
          SELECT job_id FROM job_applications
          WHERE user_id = user_jobs.user_id
        );
      `
    },
    {
      id: "026_backfill_scraped_jobs_profile_tag",
      sql: `
        -- Tag scraped_jobs to the active profile of the user whose
        -- search_query matches, using user_job_searches as the link.
        -- Not perfect for historical data but far better than NULL.
        UPDATE scraped_jobs
        SET domain_profile_id = (
          SELECT dp.id
          FROM user_job_searches ujs
          JOIN domain_profiles dp
            ON dp.user_id = ujs.user_id
            AND dp.is_active = 1
          WHERE LOWER(ujs.search_query) = LOWER(scraped_jobs.search_query)
          LIMIT 1
        )
        WHERE domain_profile_id IS NULL;
      `,
    },
    {
      id: "027_backfill_user_jobs_profile_tag",
      sql: `
        -- Pull domain_profile_id from the scraped_job onto any user_jobs
        -- rows that are still NULL-tagged but whose scraped_job is now tagged.
        UPDATE user_jobs
        SET domain_profile_id = (
          SELECT sj.domain_profile_id
          FROM scraped_jobs sj
          WHERE sj.job_id = user_jobs.job_id
            AND sj.domain_profile_id IS NOT NULL
          LIMIT 1
        )
        WHERE domain_profile_id IS NULL
          AND job_id IN (
            SELECT job_id FROM scraped_jobs WHERE domain_profile_id IS NOT NULL
          );

        -- Remove any remaining NULL-tagged user_jobs that couldn't be matched
        -- and are not applied jobs (safe to drop — they'd never appear anyway).
        DELETE FROM user_jobs
        WHERE domain_profile_id IS NULL
          AND job_id NOT IN (
            SELECT job_id FROM job_applications WHERE user_id = user_jobs.user_id
          );
      `,
    },
    {
      id: "028_remove_irrelevant_swe_jobs",
      sql: `
        -- Remove from user_jobs any job tagged to an engineering profile
        -- whose title contains no SWE-relevant keyword. These were incorrectly
        -- inserted when the title relevance filter was broken and then backfilled.
        DELETE FROM user_jobs
        WHERE domain_profile_id IN (
          SELECT id FROM domain_profiles WHERE role_family = 'engineering'
        )
        AND job_id IN (
          SELECT job_id FROM scraped_jobs
          WHERE (
            LOWER(title) NOT LIKE '%engineer%'
            AND LOWER(title) NOT LIKE '%developer%'
            AND LOWER(title) NOT LIKE '%software%'
            AND LOWER(title) NOT LIKE '%programmer%'
            AND LOWER(title) NOT LIKE '%devops%'
            AND LOWER(title) NOT LIKE '%sre%'
            AND LOWER(title) NOT LIKE '%architect%'
            AND LOWER(title) NOT LIKE '%data%'
            AND LOWER(title) NOT LIKE '%machine learning%'
            AND LOWER(title) NOT LIKE '%ml%'
            AND LOWER(title) NOT LIKE '%ai%'
            AND LOWER(title) NOT LIKE '%backend%'
            AND LOWER(title) NOT LIKE '%frontend%'
            AND LOWER(title) NOT LIKE '%fullstack%'
            AND LOWER(title) NOT LIKE '%full stack%'
            AND LOWER(title) NOT LIKE '%platform%'
            AND LOWER(title) NOT LIKE '%infrastructure%'
            AND LOWER(title) NOT LIKE '%cloud%'
            AND LOWER(title) NOT LIKE '%systems%'
            AND LOWER(title) NOT LIKE '%technical%'
            AND LOWER(title) NOT LIKE '%technology%'
            AND LOWER(title) NOT LIKE '%security%'
            AND LOWER(title) NOT LIKE '%analyst%'
            AND LOWER(title) NOT LIKE '%scientist%'
          )
        )
        AND job_id NOT IN (
          SELECT job_id FROM job_applications WHERE user_id = user_jobs.user_id
        );

        -- Also purge from scraped_jobs if no user has applied to them
        DELETE FROM scraped_jobs
        WHERE domain_profile_id IN (
          SELECT id FROM domain_profiles WHERE role_family = 'engineering'
        )
        AND (
          LOWER(title) NOT LIKE '%engineer%'
          AND LOWER(title) NOT LIKE '%developer%'
          AND LOWER(title) NOT LIKE '%software%'
          AND LOWER(title) NOT LIKE '%programmer%'
          AND LOWER(title) NOT LIKE '%devops%'
          AND LOWER(title) NOT LIKE '%architect%'
          AND LOWER(title) NOT LIKE '%data%'
          AND LOWER(title) NOT LIKE '%machine learning%'
          AND LOWER(title) NOT LIKE '%platform%'
          AND LOWER(title) NOT LIKE '%infrastructure%'
          AND LOWER(title) NOT LIKE '%cloud%'
          AND LOWER(title) NOT LIKE '%systems%'
          AND LOWER(title) NOT LIKE '%technical%'
          AND LOWER(title) NOT LIKE '%security%'
          AND LOWER(title) NOT LIKE '%analyst%'
          AND LOWER(title) NOT LIKE '%scientist%'
        )
        AND job_id NOT IN (SELECT DISTINCT job_id FROM job_applications);
      `,
    },
    {
      id: "029_remove_irrelevant_pm_jobs",
      sql: `
        -- Remove from user_jobs any job tagged to a PM profile
        -- whose title contains no PM-relevant keyword.
        DELETE FROM user_jobs
        WHERE domain_profile_id IN (
          SELECT id FROM domain_profiles WHERE role_family = 'pm'
        )
        AND job_id IN (
          SELECT job_id FROM scraped_jobs
          WHERE (
            LOWER(title) NOT LIKE '%project%'
            AND LOWER(title) NOT LIKE '%program%'
            AND LOWER(title) NOT LIKE '%product%'
            AND LOWER(title) NOT LIKE '%manager%'
            AND LOWER(title) NOT LIKE '%coordinator%'
            AND LOWER(title) NOT LIKE '%director%'
            AND LOWER(title) NOT LIKE '%lead%'
            AND LOWER(title) NOT LIKE '%agile%'
            AND LOWER(title) NOT LIKE '%scrum%'
            AND LOWER(title) NOT LIKE '%pmo%'
            AND LOWER(title) NOT LIKE '%delivery%'
            AND LOWER(title) NOT LIKE '%operations%'
          )
        )
        AND job_id NOT IN (
          SELECT job_id FROM job_applications WHERE user_id = user_jobs.user_id
        );
      `,
    },
    {
      id: "030_repair_profile_isolation_contamination",
      sql: `
        -- Repair non-applied profile contamination left by legacy active-profile
        -- and user_job_searches backfills. Applied rows are preserved in
        -- job_applications and hidden from active boards by applied filters.

        DELETE FROM user_jobs
        WHERE applied = 0
          AND (
            domain_profile_id IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM domain_profiles dp
              WHERE dp.id = user_jobs.domain_profile_id
                AND dp.user_id = user_jobs.user_id
            )
            OR NOT EXISTS (
              SELECT 1 FROM scraped_jobs sj
              WHERE sj.job_id = user_jobs.job_id
                AND sj.domain_profile_id = user_jobs.domain_profile_id
            )
          );

        UPDATE scraped_jobs
        SET domain_profile_id = NULL
        WHERE domain_profile_id IN (SELECT id FROM domain_profiles WHERE role_family = 'engineering')
          AND job_id NOT IN (SELECT DISTINCT job_id FROM job_applications)
          AND LOWER(title) NOT LIKE '%engineer%'
          AND LOWER(title) NOT LIKE '%developer%'
          AND LOWER(title) NOT LIKE '%software%'
          AND LOWER(title) NOT LIKE '%programmer%'
          AND LOWER(title) NOT LIKE '%devops%'
          AND LOWER(title) NOT LIKE '%sre%'
          AND LOWER(title) NOT LIKE '%architect%'
          AND LOWER(title) NOT LIKE '%backend%'
          AND LOWER(title) NOT LIKE '%frontend%'
          AND LOWER(title) NOT LIKE '%fullstack%'
          AND LOWER(title) NOT LIKE '%full stack%'
          AND LOWER(title) NOT LIKE '%platform%'
          AND LOWER(title) NOT LIKE '%infrastructure%'
          AND LOWER(title) NOT LIKE '%cloud%'
          AND LOWER(title) NOT LIKE '%systems%'
          AND LOWER(title) NOT LIKE '%security%';

        UPDATE scraped_jobs
        SET domain_profile_id = NULL
        WHERE domain_profile_id IN (SELECT id FROM domain_profiles WHERE role_family = 'pm')
          AND job_id NOT IN (SELECT DISTINCT job_id FROM job_applications)
          AND LOWER(title) NOT LIKE '%project%'
          AND LOWER(title) NOT LIKE '%program%'
          AND LOWER(title) NOT LIKE '%product%'
          AND LOWER(title) NOT LIKE '%manager%'
          AND LOWER(title) NOT LIKE '%coordinator%'
          AND LOWER(title) NOT LIKE '%director%'
          AND LOWER(title) NOT LIKE '%lead%'
          AND LOWER(title) NOT LIKE '%agile%'
          AND LOWER(title) NOT LIKE '%scrum%'
          AND LOWER(title) NOT LIKE '%pmo%'
          AND LOWER(title) NOT LIKE '%delivery%'
          AND LOWER(title) NOT LIKE '%operations%';

        UPDATE scraped_jobs
        SET domain_profile_id = NULL
        WHERE domain_profile_id IN (SELECT id FROM domain_profiles WHERE role_family = 'data')
          AND job_id NOT IN (SELECT DISTINCT job_id FROM job_applications)
          AND LOWER(title) NOT LIKE '%data%'
          AND LOWER(title) NOT LIKE '%analytics%'
          AND LOWER(title) NOT LIKE '%analyst%'
          AND LOWER(title) NOT LIKE '%scientist%'
          AND LOWER(title) NOT LIKE '%machine learning%'
          AND LOWER(title) NOT LIKE '%ml%'
          AND LOWER(title) NOT LIKE '%ai%'
          AND LOWER(title) NOT LIKE '%business intelligence%'
          AND LOWER(title) NOT LIKE '%bi%'
          AND LOWER(title) NOT LIKE '%research%'
          AND LOWER(title) NOT LIKE '%quantitative%';

        DELETE FROM user_jobs
        WHERE applied = 0
          AND NOT EXISTS (
            SELECT 1 FROM scraped_jobs sj
            WHERE sj.job_id = user_jobs.job_id
              AND sj.domain_profile_id = user_jobs.domain_profile_id
          );
      `,
    },
    // Add future migrations here — never edit existing ones
    {
      id: "031_shared_job_role_map",
      sql: `
        CREATE TABLE IF NOT EXISTS job_role_map (
          job_id TEXT NOT NULL REFERENCES scraped_jobs(job_id) ON DELETE CASCADE,
          role_key TEXT NOT NULL,
          role_family TEXT,
          domain TEXT,
          source_profile_id INTEGER REFERENCES domain_profiles(id) ON DELETE SET NULL,
          confidence REAL NOT NULL DEFAULT 1.0,
          matched_by TEXT NOT NULL DEFAULT 'profile_scrape',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (job_id, role_key)
        );
        CREATE INDEX IF NOT EXISTS idx_job_role_map_role
          ON job_role_map(role_key, job_id);
        CREATE INDEX IF NOT EXISTS idx_job_role_map_job
          ON job_role_map(job_id);

        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, source_profile_id, confidence, matched_by)
        SELECT sj.job_id,
               LOWER(COALESCE(NULLIF(dp.role_family, ''), dp.domain)),
               dp.role_family,
               dp.domain,
               dp.id,
               0.8,
               'legacy_domain_profile_id'
        FROM scraped_jobs sj
        JOIN domain_profiles dp ON dp.id = sj.domain_profile_id;

        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT job_id, 'engineering', 'engineering', 'engineering', 0.6, 'title_heuristic'
        FROM scraped_jobs
        WHERE LOWER(title) LIKE '%engineer%'
           OR LOWER(title) LIKE '%developer%'
           OR LOWER(title) LIKE '%software%'
           OR LOWER(title) LIKE '%devops%'
           OR LOWER(title) LIKE '%sre%'
           OR LOWER(title) LIKE '%backend%'
           OR LOWER(title) LIKE '%frontend%'
           OR LOWER(title) LIKE '%full stack%'
           OR LOWER(title) LIKE '%fullstack%';

        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT job_id, 'pm', 'pm', 'pm_general', 0.6, 'title_heuristic'
        FROM scraped_jobs
        WHERE LOWER(title) LIKE '%project%'
           OR LOWER(title) LIKE '%program%'
           OR LOWER(title) LIKE '%product%'
           OR LOWER(title) LIKE '%scrum%'
           OR LOWER(title) LIKE '%pmo%'
           OR LOWER(title) LIKE '%delivery manager%';

        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT job_id, 'data', 'data', 'data', 0.6, 'title_heuristic'
        FROM scraped_jobs
        WHERE LOWER(title) LIKE '%data%'
           OR LOWER(title) LIKE '%analytics%'
           OR LOWER(title) LIKE '%analyst%'
           OR LOWER(title) LIKE '%scientist%'
           OR LOWER(title) LIKE '%machine learning%'
           OR LOWER(title) LIKE '%business intelligence%';
      `,
    },
    {
      id: "032_password_reset_tokens",
      sql: `
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          otp_hash TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          used_at INTEGER,
          requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
          request_ip TEXT,
          user_agent TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_password_reset_user
          ON password_reset_tokens(user_id, used_at, expires_at);
        CREATE INDEX IF NOT EXISTS idx_password_reset_expires
          ON password_reset_tokens(expires_at);
      `,
    },
    {
      id: "033_plan_tiers_and_simple_apply_profile",
      sql: `
        ALTER TABLE users ADD COLUMN plan_tier TEXT NOT NULL DEFAULT 'BASIC';
        UPDATE users
        SET plan_tier = CASE
          WHEN apply_mode = 'CUSTOM_SAMPLER' THEN 'PRO'
          WHEN apply_mode = 'TAILORED' THEN 'PLUS'
          ELSE 'BASIC'
        END;

        CREATE TABLE IF NOT EXISTS plan_upgrade_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          requested_tier TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
          decided_at INTEGER,
          decided_by INTEGER REFERENCES users(id),
          notes TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_plan_upgrade_requests_status
          ON plan_upgrade_requests(status, requested_at);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_upgrade_one_pending
          ON plan_upgrade_requests(user_id) WHERE status = 'pending';

        CREATE TABLE IF NOT EXISTS simple_apply_profiles (
          user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          titles_json TEXT NOT NULL DEFAULT '[]',
          keywords_json TEXT NOT NULL DEFAULT '[]',
          skills_json TEXT NOT NULL DEFAULT '[]',
          search_terms_json TEXT NOT NULL DEFAULT '[]',
          source_hash TEXT,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      id: "034_plan_reset_and_profile_repair",
      sql: `
        UPDATE users
        SET plan_tier = 'BASIC'
        WHERE plan_tier IS NULL
           OR plan_tier NOT IN ('BASIC','PLUS','PRO');

        UPDATE users
        SET apply_mode = CASE plan_tier
          WHEN 'PRO' THEN 'CUSTOM_SAMPLER'
          WHEN 'PLUS' THEN 'TAILORED'
          ELSE 'SIMPLE'
        END
        WHERE apply_mode IS NULL
           OR apply_mode NOT IN ('SIMPLE','TAILORED','CUSTOM_SAMPLER')
           OR (plan_tier = 'BASIC' AND apply_mode != 'SIMPLE')
           OR (plan_tier = 'PLUS' AND apply_mode != 'TAILORED')
           OR (plan_tier = 'PRO' AND apply_mode != 'CUSTOM_SAMPLER');

        DELETE FROM password_reset_tokens
        WHERE used_at IS NOT NULL
           OR expires_at <= unixepoch() - 86400;

        DELETE FROM user_jobs
        WHERE applied = 0
          AND (
            domain_profile_id IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM domain_profiles dp
              WHERE dp.id = user_jobs.domain_profile_id
                AND dp.user_id = user_jobs.user_id
            )
          );
      `,
    },
    {
      id: "035_prune_stale_role_maps",
      sql: `
        DELETE FROM job_role_map
        WHERE role_key = 'engineering'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%engineer%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%developer%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%software%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%programmer%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%devops%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%sre%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%architect%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%backend%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%frontend%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%fullstack%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%full stack%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%platform%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%infrastructure%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%cloud%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%systems%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%security%';

        DELETE FROM user_jobs
        WHERE applied = 0
          AND NOT EXISTS (
            SELECT 1 FROM job_role_map jrm
            JOIN domain_profiles dp
              ON dp.id = user_jobs.domain_profile_id
             AND jrm.role_key = LOWER(COALESCE(NULLIF(dp.role_family, ''), dp.domain))
            WHERE jrm.job_id = user_jobs.job_id
          );
      `,
    },
    {
      id: "036_console_tier_profile_repair",
      sql: `
        UPDATE users
        SET plan_tier = 'BASIC'
        WHERE plan_tier IS NULL
           OR plan_tier NOT IN ('BASIC','PLUS','PRO');

        UPDATE users
        SET apply_mode = CASE plan_tier
          WHEN 'PRO' THEN 'CUSTOM_SAMPLER'
          WHEN 'PLUS' THEN 'TAILORED'
          ELSE 'SIMPLE'
        END
        WHERE apply_mode IS NULL
           OR apply_mode NOT IN ('SIMPLE','TAILORED','CUSTOM_SAMPLER')
           OR (plan_tier = 'BASIC' AND apply_mode != 'SIMPLE')
           OR (plan_tier = 'PLUS' AND apply_mode != 'TAILORED')
           OR (plan_tier = 'PRO' AND apply_mode != 'CUSTOM_SAMPLER');

        DELETE FROM job_role_map
        WHERE job_id NOT IN (SELECT job_id FROM scraped_jobs);

        DELETE FROM job_role_map
        WHERE role_key = 'engineering'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%engineer%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%developer%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%software%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%programmer%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%devops%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%sre%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%architect%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%backend%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%frontend%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%fullstack%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%full stack%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%platform%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%infrastructure%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%cloud%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%systems%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%security%';

        DELETE FROM job_role_map
        WHERE role_key = 'pm'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%project%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%program%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%product%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%manager%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%coordinator%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%director%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%agile%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%scrum%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%pmo%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%delivery%';

        DELETE FROM job_role_map
        WHERE role_key = 'data'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%data%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%analytics%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%analyst%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%scientist%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%machine learning%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%ml%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%ai%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%business intelligence%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%bi%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%research%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%quantitative%';

        DELETE FROM user_jobs
        WHERE applied = 0
          AND (
            domain_profile_id IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM domain_profiles dp
              WHERE dp.id = user_jobs.domain_profile_id
                AND dp.user_id = user_jobs.user_id
            )
            OR NOT EXISTS (
              SELECT 1
              FROM domain_profiles dp
              JOIN job_role_map jrm
                ON jrm.job_id = user_jobs.job_id
               AND jrm.role_key = LOWER(COALESCE(NULLIF(dp.role_family, ''), dp.domain))
              WHERE dp.id = user_jobs.domain_profile_id
                AND dp.user_id = user_jobs.user_id
            )
          );
      `,
    },
    {
      id: "037_domain_profile_requests",
      sql: `
        CREATE TABLE IF NOT EXISTS domain_profile_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          desired_title TEXT NOT NULL,
          role_family TEXT,
          target_titles_json TEXT NOT NULL DEFAULT '[]',
          skills_json TEXT NOT NULL DEFAULT '[]',
          tools_json TEXT NOT NULL DEFAULT '[]',
          industries_json TEXT NOT NULL DEFAULT '[]',
          keywords_json TEXT NOT NULL DEFAULT '[]',
          seniority TEXT,
          work_preference TEXT,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_domain_profile_requests_status
          ON domain_profile_requests(status, created_at);
        CREATE INDEX IF NOT EXISTS idx_domain_profile_requests_user
          ON domain_profile_requests(user_id, created_at);
      `,
    },
    {
      id: "038_role_map_ml_pm_repair",
      sql: `
        DELETE FROM job_role_map
        WHERE role_key = 'engineering'
          AND job_id IN (
            SELECT job_id FROM scraped_jobs
            WHERE LOWER(title) LIKE '%machine learning%'
               OR LOWER(title) LIKE '%ml engineer%'
               OR LOWER(title) LIKE '%ai engineer%'
               OR LOWER(title) LIKE '%artificial intelligence%'
               OR LOWER(title) LIKE '%llm%'
               OR LOWER(title) LIKE '%genai%'
               OR LOWER(title) LIKE '%generative ai%'
               OR LOWER(title) LIKE '%project manager%'
               OR LOWER(title) LIKE '%program manager%'
               OR LOWER(title) LIKE '%product manager%'
               OR LOWER(title) LIKE '%project coordinator%'
               OR LOWER(title) LIKE '%scrum master%'
               OR LOWER(title) LIKE '%pmo%'
          );

        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT job_id, 'data', 'data', 'data', 0.95, 'ml_ai_repair'
        FROM scraped_jobs
        WHERE LOWER(title) LIKE '%machine learning%'
           OR LOWER(title) LIKE '%ml engineer%'
           OR LOWER(title) LIKE '%ai engineer%'
           OR LOWER(title) LIKE '%artificial intelligence%'
           OR LOWER(title) LIKE '%llm%'
           OR LOWER(title) LIKE '%genai%'
           OR LOWER(title) LIKE '%generative ai%';

        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT job_id, 'pm', 'pm', 'pm_general', 0.95, 'pm_repair'
        FROM scraped_jobs
        WHERE LOWER(title) LIKE '%project manager%'
           OR LOWER(title) LIKE '%program manager%'
           OR LOWER(title) LIKE '%product manager%'
           OR LOWER(title) LIKE '%project coordinator%'
           OR LOWER(title) LIKE '%scrum master%'
           OR LOWER(title) LIKE '%pmo%';
      `,
    },
    {
      id: "039_resume_version_tool_artifacts",
      sql: `
        ALTER TABLE resume_versions ADD COLUMN tool_type TEXT NOT NULL DEFAULT 'generate';
        ALTER TABLE resume_versions ADD COLUMN is_kept INTEGER NOT NULL DEFAULT 0;
        UPDATE resume_versions
        SET tool_type = CASE
          WHEN EXISTS (
            SELECT 1 FROM resumes r
            WHERE r.user_id = resume_versions.user_id
              AND r.job_id = resume_versions.job_id
              AND r.apply_mode = 'CUSTOM_SAMPLER'
          ) THEN 'a_plus_resume'
          ELSE 'generate'
        END
        WHERE tool_type IS NULL OR tool_type = '';
      `,
    },
    {
      id: "040_tab_scoped_auth_contexts",
      sql: `
        CREATE TABLE IF NOT EXISTS auth_contexts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_hash TEXT NOT NULL UNIQUE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
          expires_at INTEGER NOT NULL,
          revoked_at INTEGER,
          user_agent TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_auth_contexts_user
          ON auth_contexts(user_id, revoked_at, expires_at);
        CREATE INDEX IF NOT EXISTS idx_auth_contexts_expiry
          ON auth_contexts(expires_at, revoked_at);
      `,
    },
    {
      id: "041_resume_ats_cache_metadata",
      sql: `
        ALTER TABLE resumes ADD COLUMN ats_cache_key TEXT;
        ALTER TABLE resumes ADD COLUMN ats_prompt_version TEXT;
        ALTER TABLE resume_versions ADD COLUMN ats_cache_key TEXT;
        ALTER TABLE resume_versions ADD COLUMN ats_prompt_version TEXT;
        CREATE INDEX IF NOT EXISTS idx_resume_versions_ats_cache
          ON resume_versions(user_id, job_id, tool_type, ats_cache_key);
      `,
    },
    {
      id: "042_apply_runs_queue",
      sql: `
        CREATE TABLE IF NOT EXISTS apply_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          mode TEXT NOT NULL DEFAULT 'auto',
          tool_type TEXT,
          status TEXT NOT NULL DEFAULT 'queued',
          total_jobs INTEGER NOT NULL DEFAULT 0,
          submitted_count INTEGER NOT NULL DEFAULT 0,
          held_count INTEGER NOT NULL DEFAULT 0,
          failed_count INTEGER NOT NULL DEFAULT 0,
          started_at INTEGER,
          finished_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS apply_run_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL REFERENCES apply_runs(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued',
          reason_code TEXT,
          reason_detail TEXT,
          ats_score INTEGER,
          resume_id INTEGER,
          resume_file TEXT,
          attempt_count INTEGER NOT NULL DEFAULT 0,
          locked_at INTEGER,
          started_at INTEGER,
          finished_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(run_id, job_id)
        );
        CREATE TABLE IF NOT EXISTS apply_job_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER,
          run_job_id INTEGER,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT,
          level TEXT NOT NULL DEFAULT 'info',
          event TEXT NOT NULL,
          message TEXT,
          details_json TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_apply_runs_user_status ON apply_runs(user_id, status, created_at);
        CREATE INDEX IF NOT EXISTS idx_apply_run_jobs_user_status ON apply_run_jobs(user_id, status, created_at);
        CREATE INDEX IF NOT EXISTS idx_apply_logs_run ON apply_job_logs(run_id, run_job_id, created_at);
      `,
    },
    {
      id: "043_user_integrations",
      sql: `
        CREATE TABLE IF NOT EXISTS user_integrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider TEXT NOT NULL,
          account_email TEXT,
          status TEXT NOT NULL DEFAULT 'connected',
          scopes_json TEXT NOT NULL DEFAULT '[]',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          secret_enc TEXT,
          iv TEXT,
          auth_tag TEXT,
          expires_at INTEGER,
          last_checked_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(user_id, provider)
        );
        CREATE INDEX IF NOT EXISTS idx_user_integrations_user_provider
          ON user_integrations(user_id, provider, status);
      `,
    },
    {
      id: "044_auth_provider_links",
      sql: `
        ALTER TABLE users ADD COLUMN google_auth_id TEXT;
        ALTER TABLE users ADD COLUMN linkedin_auth_id TEXT;
        ALTER TABLE user_integrations ADD COLUMN provider_user_id TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_auth_id
          ON users(google_auth_id) WHERE google_auth_id IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_linkedin_auth_id
          ON users(linkedin_auth_id) WHERE linkedin_auth_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_user_integrations_provider_identity
          ON user_integrations(provider, provider_user_id);
      `,
    },
    {
      id: "053_github_auth_provider_link",
      sql: `
        ALTER TABLE users ADD COLUMN github_auth_id TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_auth_id
          ON users(github_auth_id) WHERE github_auth_id IS NOT NULL;
      `,
    },
    {
      // Repair: firmware/embedded jobs were bulk-assigned role_key='engineering' by
      // the title_heuristic in migration 031 and were never corrected.  This migration:
      //   1. Adds role_key='engineering_embedded_firmware' for jobs scraped under
      //      firmware domain profiles.
      //   2. Adds role_key='engineering_embedded_firmware' for jobs whose title
      //      clearly indicates firmware/embedded work (title heuristic).
      //   3. Removes the stale role_key='engineering' entries that arrived via the
      //      generic title_heuristic for those same jobs — so SWE users never see
      //      them even if roleKeyForProfile returns 'engineering'.
      //   Jobs that were explicitly scraped under a SWE profile (matched_by =
      //   'profile_scrape') keep their 'engineering' entry so they remain visible
      //   to the scraping user; the roleTitleSql firmware exclusions still prevent
      //   them from surfacing in SWE results for other users.
      id: "045_firmware_role_map_repair",
      sql: `
        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT jrm.job_id,
               'engineering_embedded_firmware',
               'engineering',
               'engineering_embedded_firmware',
               0.95,
               'firmware_profile_repair'
        FROM job_role_map jrm
        JOIN domain_profiles dp ON dp.id = jrm.source_profile_id
        WHERE jrm.role_key = 'engineering'
          AND dp.domain = 'engineering_embedded_firmware';

        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT job_id,
               'engineering_embedded_firmware',
               'engineering',
               'engineering_embedded_firmware',
               0.9,
               'firmware_title_repair'
        FROM scraped_jobs
        WHERE LOWER(title) LIKE '%firmware%'
           OR LOWER(title) LIKE '%embedded%'
           OR LOWER(title) LIKE '%bsp%'
           OR LOWER(title) LIKE '%device driver%'
           OR LOWER(title) LIKE '%silicon validation%'
           OR LOWER(title) LIKE '%post-silicon%'
           OR LOWER(title) LIKE '%post silicon%'
           OR LOWER(title) LIKE '%soc bring%'
           OR LOWER(title) LIKE '%board bring%'
           OR LOWER(title) LIKE '%chip bring%'
           OR LOWER(title) LIKE '%bootloader%'
           OR LOWER(title) LIKE '%rtos%'
           OR LOWER(title) LIKE '% bios %'
           OR LOWER(title) LIKE 'bios %'
           OR LOWER(title) LIKE '%uefi%';

        DELETE FROM job_role_map
        WHERE role_key = 'engineering'
          AND matched_by = 'title_heuristic'
          AND job_id IN (
            SELECT job_id FROM scraped_jobs
            WHERE LOWER(title) LIKE '%firmware%'
               OR LOWER(title) LIKE '%embedded%'
               OR LOWER(title) LIKE '%bsp%'
               OR LOWER(title) LIKE '%device driver%'
               OR LOWER(title) LIKE '%silicon validation%'
               OR LOWER(title) LIKE '%post-silicon%'
               OR LOWER(title) LIKE '%post silicon%'
               OR LOWER(title) LIKE '%soc bring%'
               OR LOWER(title) LIKE '%board bring%'
               OR LOWER(title) LIKE '%chip bring%'
               OR LOWER(title) LIKE '%bootloader%'
               OR LOWER(title) LIKE '%rtos%'
               OR LOWER(title) LIKE '% bios %'
               OR LOWER(title) LIKE 'bios %'
               OR LOWER(title) LIKE '%uefi%'
          );
      `,
    },
    {
      // Repair: data scientist / data engineer / analytics engineer titles
      // were incorrectly assigned role_key='engineering' in two ways:
      //   1. Scraped under an engineering profile (assignJobRoleMap => 'engineering')
      //   2. Title matched '%engineer%' / '%developer%' in migration 031 heuristic
      // Migration 038 already handled ML/AI/PM titles.  This migration extends that
      // repair to cover data-family specialty titles that were missed.
      //
      // Only removes heuristic and profile-scrape engineering entries — manual_review
      // entries are preserved (admin override must win).
      id: "046_data_specialty_role_repair",
      sql: `
        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT job_id, 'data', 'data', 'data', 0.95, 'data_specialty_repair'
        FROM scraped_jobs
        WHERE LOWER(title) LIKE '%data scientist%'
           OR LOWER(title) LIKE '%data engineer%'
           OR LOWER(title) LIKE '%analytics engineer%'
           OR LOWER(title) LIKE '%research scientist%'
           OR LOWER(title) LIKE '%applied scientist%'
           OR LOWER(title) LIKE '%ml platform engineer%'
           OR LOWER(title) LIKE '%mlops engineer%';

        DELETE FROM job_role_map
        WHERE role_key = 'engineering'
          AND matched_by IN ('title_heuristic', 'legacy_domain_profile_id',
                             'duplicate_profile_scrape', 'profile_scrape')
          AND job_id IN (
            SELECT job_id FROM scraped_jobs
            WHERE LOWER(title) LIKE '%data scientist%'
               OR LOWER(title) LIKE '%data engineer%'
               OR LOWER(title) LIKE '%analytics engineer%'
               OR LOWER(title) LIKE '%research scientist%'
               OR LOWER(title) LIKE '%applied scientist%'
               OR LOWER(title) LIKE '%ml platform engineer%'
               OR LOWER(title) LIKE '%mlops engineer%'
          );
      `,
    },
    {
      // 047 — Repair existing orphaned jobs that have no job_role_map entry.
      //
      // These are jobs that were scraped without a domainProfile (admin scrapes,
      // profiles deleted post-scrape, or pre-046 legacy ingests) and therefore
      // fell through the assignJobRoleMap() guard.  The ingest-time classifier
      // now handles new orphans; this migration back-fills the historical gap
      // using the same high-confidence title patterns.
      //
      // Only assigns role_key when the title strongly matches a single family.
      // Preserves manual_review entries — admin overrides are never touched.
      id: "047_orphaned_job_classifier_repair",
      sql: `
        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT sj.job_id,
               CASE
                 WHEN LOWER(sj.title) LIKE '%firmware engineer%'
                   OR LOWER(sj.title) LIKE '%embedded systems engineer%'
                   OR LOWER(sj.title) LIKE '%bsp engineer%'
                   OR LOWER(sj.title) LIKE '%uefi engineer%'
                   OR LOWER(sj.title) LIKE '%device driver engineer%'
                   OR LOWER(sj.title) LIKE '%bootloader engineer%'
                   OR LOWER(sj.title) LIKE '%rtos engineer%'
                 THEN 'engineering_embedded_firmware'
                 WHEN LOWER(sj.title) LIKE '%machine learning engineer%'
                   OR LOWER(sj.title) LIKE '%data scientist%'
                   OR LOWER(sj.title) LIKE '%data engineer%'
                   OR LOWER(sj.title) LIKE '%analytics engineer%'
                   OR LOWER(sj.title) LIKE '%ml engineer%'
                   OR LOWER(sj.title) LIKE '%ai engineer%'
                   OR LOWER(sj.title) LIKE '%research scientist%'
                   OR LOWER(sj.title) LIKE '%applied scientist%'
                 THEN 'data'
                 WHEN LOWER(sj.title) LIKE '%product manager%'
                   OR LOWER(sj.title) LIKE '%project manager%'
                   OR LOWER(sj.title) LIKE '%program manager%'
                   OR LOWER(sj.title) LIKE '%scrum master%'
                   OR LOWER(sj.title) LIKE '%product owner%'
                 THEN 'pm'
                 WHEN LOWER(sj.title) LIKE '%software engineer%'
                   OR LOWER(sj.title) LIKE '%backend engineer%'
                   OR LOWER(sj.title) LIKE '%frontend engineer%'
                   OR LOWER(sj.title) LIKE '%full stack engineer%'
                   OR LOWER(sj.title) LIKE '%devops engineer%'
                   OR LOWER(sj.title) LIKE '%site reliability engineer%'
                   OR LOWER(sj.title) LIKE '%software developer%'
                   OR LOWER(sj.title) LIKE '%platform engineer%'
                   OR LOWER(sj.title) LIKE '%mobile engineer%'
                 THEN 'engineering'
               END AS role_key,
               CASE
                 WHEN LOWER(sj.title) LIKE '%firmware engineer%'
                   OR LOWER(sj.title) LIKE '%embedded systems engineer%'
                   OR LOWER(sj.title) LIKE '%bsp engineer%'
                   OR LOWER(sj.title) LIKE '%uefi engineer%'
                   OR LOWER(sj.title) LIKE '%device driver engineer%'
                   OR LOWER(sj.title) LIKE '%bootloader engineer%'
                   OR LOWER(sj.title) LIKE '%rtos engineer%'
                 THEN 'engineering'
                 WHEN LOWER(sj.title) LIKE '%machine learning engineer%'
                   OR LOWER(sj.title) LIKE '%data scientist%'
                   OR LOWER(sj.title) LIKE '%data engineer%'
                   OR LOWER(sj.title) LIKE '%analytics engineer%'
                   OR LOWER(sj.title) LIKE '%ml engineer%'
                   OR LOWER(sj.title) LIKE '%ai engineer%'
                   OR LOWER(sj.title) LIKE '%research scientist%'
                   OR LOWER(sj.title) LIKE '%applied scientist%'
                 THEN 'data'
                 ELSE role_key
               END AS role_family,
               CASE
                 WHEN LOWER(sj.title) LIKE '%firmware engineer%'
                   OR LOWER(sj.title) LIKE '%embedded systems engineer%'
                   OR LOWER(sj.title) LIKE '%bsp engineer%'
                   OR LOWER(sj.title) LIKE '%uefi engineer%'
                   OR LOWER(sj.title) LIKE '%device driver engineer%'
                   OR LOWER(sj.title) LIKE '%bootloader engineer%'
                   OR LOWER(sj.title) LIKE '%rtos engineer%'
                 THEN 'engineering_embedded_firmware'
                 WHEN LOWER(sj.title) LIKE '%software engineer%'
                   OR LOWER(sj.title) LIKE '%backend engineer%'
                   OR LOWER(sj.title) LIKE '%frontend engineer%'
                   OR LOWER(sj.title) LIKE '%full stack engineer%'
                   OR LOWER(sj.title) LIKE '%devops engineer%'
                   OR LOWER(sj.title) LIKE '%site reliability engineer%'
                   OR LOWER(sj.title) LIKE '%software developer%'
                   OR LOWER(sj.title) LIKE '%platform engineer%'
                   OR LOWER(sj.title) LIKE '%mobile engineer%'
                 THEN 'it_digital'
                 ELSE role_key
               END AS domain,
               0.85 AS confidence,
               'orphan_repair' AS matched_by
        FROM scraped_jobs sj
        LEFT JOIN job_role_map jrm ON jrm.job_id = sj.job_id
        WHERE jrm.job_id IS NULL
          AND (
            LOWER(sj.title) LIKE '%firmware engineer%'
            OR LOWER(sj.title) LIKE '%embedded systems engineer%'
            OR LOWER(sj.title) LIKE '%bsp engineer%'
            OR LOWER(sj.title) LIKE '%uefi engineer%'
            OR LOWER(sj.title) LIKE '%device driver engineer%'
            OR LOWER(sj.title) LIKE '%bootloader engineer%'
            OR LOWER(sj.title) LIKE '%rtos engineer%'
            OR LOWER(sj.title) LIKE '%machine learning engineer%'
            OR LOWER(sj.title) LIKE '%data scientist%'
            OR LOWER(sj.title) LIKE '%data engineer%'
            OR LOWER(sj.title) LIKE '%analytics engineer%'
            OR LOWER(sj.title) LIKE '%ml engineer%'
            OR LOWER(sj.title) LIKE '%ai engineer%'
            OR LOWER(sj.title) LIKE '%research scientist%'
            OR LOWER(sj.title) LIKE '%applied scientist%'
            OR LOWER(sj.title) LIKE '%product manager%'
            OR LOWER(sj.title) LIKE '%project manager%'
            OR LOWER(sj.title) LIKE '%program manager%'
            OR LOWER(sj.title) LIKE '%scrum master%'
            OR LOWER(sj.title) LIKE '%product owner%'
            OR LOWER(sj.title) LIKE '%software engineer%'
            OR LOWER(sj.title) LIKE '%backend engineer%'
            OR LOWER(sj.title) LIKE '%frontend engineer%'
            OR LOWER(sj.title) LIKE '%full stack engineer%'
            OR LOWER(sj.title) LIKE '%devops engineer%'
            OR LOWER(sj.title) LIKE '%site reliability engineer%'
            OR LOWER(sj.title) LIKE '%software developer%'
            OR LOWER(sj.title) LIKE '%platform engineer%'
            OR LOWER(sj.title) LIKE '%mobile engineer%'
          );
      `,
    },
    {
      // Migration 048 — Re-classify existing job_role_map entries that were assigned
      // role_key='engineering' via automated classifiers but whose title clearly indicates
      // firmware/embedded. Runs in two idempotent steps:
      //
      // Step 1: DELETE stale 'engineering' rows for jobs that already have an
      //   'engineering_embedded_firmware' row — these are duplicates from migration 047,
      //   the ingest classifier, or a prior partial run of 048. Updating them would hit
      //   the UNIQUE(job_id, role_key) constraint. Deleting them is safe because the
      //   correct mapping already exists.
      //
      // Step 2: UPDATE remaining 'engineering' firmware-title rows to
      //   'engineering_embedded_firmware'. After Step 1, no conflict is possible.
      //   Both steps are no-ops on a clean or already-processed database.
      id: "048_firmware_reclassify",
      sql: `
        DELETE FROM job_role_map
        WHERE role_key = 'engineering'
          AND matched_by IN ('profile_scrape','orphan_repair','strong_anchor','strong_anchor+desc')
          AND job_id IN (
            SELECT jrm2.job_id FROM job_role_map jrm2
            WHERE jrm2.role_key = 'engineering_embedded_firmware'
          )
          AND job_id IN (
            SELECT sj.job_id FROM scraped_jobs sj
            WHERE LOWER(sj.title) LIKE '%firmware%'
               OR LOWER(sj.title) LIKE '%embedded system%'
               OR LOWER(sj.title) LIKE '% bsp %'
               OR LOWER(sj.title) LIKE 'bsp %'
               OR LOWER(sj.title) LIKE '%bsp engineer%'
               OR LOWER(sj.title) LIKE '% uefi %'
               OR LOWER(sj.title) LIKE '%uefi engineer%'
               OR LOWER(sj.title) LIKE '%device driver%'
               OR LOWER(sj.title) LIKE '%bootloader%'
               OR LOWER(sj.title) LIKE '% rtos %'
               OR LOWER(sj.title) LIKE '%rtos engineer%'
          );

        UPDATE job_role_map
        SET role_key    = 'engineering_embedded_firmware',
            role_family = 'engineering',
            domain      = 'engineering_embedded_firmware',
            confidence  = 0.88,
            matched_by  = 'firmware_reclassify'
        WHERE role_key = 'engineering'
          AND matched_by IN ('profile_scrape','orphan_repair','strong_anchor','strong_anchor+desc')
          AND job_id IN (
            SELECT sj.job_id FROM scraped_jobs sj
            WHERE LOWER(sj.title) LIKE '%firmware%'
               OR LOWER(sj.title) LIKE '%embedded system%'
               OR LOWER(sj.title) LIKE '% bsp %'
               OR LOWER(sj.title) LIKE 'bsp %'
               OR LOWER(sj.title) LIKE '%bsp engineer%'
               OR LOWER(sj.title) LIKE '% uefi %'
               OR LOWER(sj.title) LIKE '%uefi engineer%'
               OR LOWER(sj.title) LIKE '%device driver%'
               OR LOWER(sj.title) LIKE '%bootloader%'
               OR LOWER(sj.title) LIKE '% rtos %'
               OR LOWER(sj.title) LIKE '%rtos engineer%'
          );
      `,
    },
    {
      id: "049_simple_apply_profile_yoe",
      sql: `
        ALTER TABLE simple_apply_profiles ADD COLUMN years_experience INTEGER;
      `,
    },
    {
      id: "050_profile_scoped_resume_signals",
      sql: `
        CREATE TABLE IF NOT EXISTS profile_base_resumes (
          profile_id INTEGER PRIMARY KEY REFERENCES domain_profiles(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT,
          content TEXT NOT NULL,
          enhanced_content TEXT,
          enhanced_at INTEGER,
          enhanced_ats_delta INTEGER,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_profile_base_resumes_user
          ON profile_base_resumes(user_id, updated_at DESC);

        CREATE TABLE IF NOT EXISTS profile_simple_apply_profiles (
          profile_id INTEGER PRIMARY KEY REFERENCES domain_profiles(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          titles_json TEXT NOT NULL DEFAULT '[]',
          keywords_json TEXT NOT NULL DEFAULT '[]',
          skills_json TEXT NOT NULL DEFAULT '[]',
          search_terms_json TEXT NOT NULL DEFAULT '[]',
          source_hash TEXT,
          years_experience INTEGER,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_profile_simple_apply_profiles_user
          ON profile_simple_apply_profiles(user_id, updated_at DESC);
      `,
    },
    {
      id: "051_imported_saved_jobs",
      sql: `
        CREATE TABLE IF NOT EXISTS imported_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          source_key TEXT NOT NULL,
          source_label TEXT NOT NULL,
          source_platform TEXT NOT NULL,
          external_job_id TEXT,
          dedupe_key TEXT NOT NULL,
          title TEXT NOT NULL,
          company TEXT NOT NULL,
          location TEXT,
          job_url TEXT,
          apply_url TEXT,
          work_type TEXT,
          employment_type TEXT,
          compensation TEXT,
          posted_at TEXT,
          description TEXT,
          company_icon_url TEXT,
          payload_json TEXT,
          visited INTEGER NOT NULL DEFAULT 0,
          starred INTEGER NOT NULL DEFAULT 0,
          disliked INTEGER NOT NULL DEFAULT 0,
          applied INTEGER NOT NULL DEFAULT 0,
          import_count INTEGER NOT NULL DEFAULT 1,
          first_imported_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_imported_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(user_id, source_key, dedupe_key)
        );
        CREATE INDEX IF NOT EXISTS idx_imported_jobs_user_source
          ON imported_jobs(user_id, source_key, last_imported_at DESC);
        CREATE INDEX IF NOT EXISTS idx_imported_jobs_user_flags
          ON imported_jobs(user_id, disliked, starred, applied);
      `,
    },
    {
      id: "052_profile_enhancement_signals",
      sql: `
        ALTER TABLE profile_simple_apply_profiles ADD COLUMN citizenship_status TEXT;
        ALTER TABLE profile_simple_apply_profiles ADD COLUMN work_authorization TEXT;
        ALTER TABLE profile_simple_apply_profiles ADD COLUMN requires_sponsorship INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE profile_simple_apply_profiles ADD COLUMN has_clearance INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE profile_simple_apply_profiles ADD COLUMN clearance_level TEXT;
        ALTER TABLE profile_simple_apply_profiles ADD COLUMN degree_level TEXT;
        ALTER TABLE profile_simple_apply_profiles ADD COLUMN enhancement_notified_at INTEGER;

        CREATE TABLE IF NOT EXISTS profile_signal_suggestions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id INTEGER NOT NULL REFERENCES domain_profiles(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          signal_key TEXT NOT NULL,
          signal_label TEXT NOT NULL,
          signal_kind TEXT NOT NULL,
          structured_field TEXT,
          frequency INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'inactive',
          first_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
          selected_at INTEGER,
          applied_at INTEGER,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(profile_id, signal_key)
        );
        CREATE INDEX IF NOT EXISTS idx_profile_signal_suggestions_profile
          ON profile_signal_suggestions(profile_id, status, signal_kind, frequency DESC);

        CREATE TABLE IF NOT EXISTS profile_resume_enhancements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id INTEGER NOT NULL REFERENCES domain_profiles(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          base_resume_content TEXT NOT NULL,
          enhanced_content TEXT NOT NULL,
          selected_skills_json TEXT NOT NULL DEFAULT '[]',
          ats_delta INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          adopted_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_profile_resume_enhancements_profile
          ON profile_resume_enhancements(profile_id, created_at DESC);
      `,
    },
    {
      id: "054_aplus_resume_flag",
      sql: `ALTER TABLE users ADD COLUMN aplus_resume INTEGER NOT NULL DEFAULT 0;`,
    },
    {
      id: "055_user_profile_skills",
      sql: `
        ALTER TABLE user_profile ADD COLUMN confirmed_skills TEXT NOT NULL DEFAULT '[]';
        ALTER TABLE user_profile ADD COLUMN target_skills    TEXT NOT NULL DEFAULT '[]';
        ALTER TABLE user_profile ADD COLUMN target_domains   TEXT NOT NULL DEFAULT '[]';
        ALTER TABLE user_profile ADD COLUMN target_locations TEXT NOT NULL DEFAULT '[]';
        ALTER TABLE user_profile ADD COLUMN seniority_level  TEXT;
        ALTER TABLE user_profile ADD COLUMN onboarded        INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      id: "056_company_ats_list",
      sql: `
        CREATE TABLE IF NOT EXISTS company_ats_list (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          company     TEXT NOT NULL,
          ats_type    TEXT NOT NULL,
          ats_slug    TEXT NOT NULL,
          active      INTEGER NOT NULL DEFAULT 1,
          bucket_role TEXT,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(ats_type, ats_slug)
        );
        INSERT OR IGNORE INTO company_ats_list (company, ats_type, ats_slug, bucket_role) VALUES
          ('Stripe',     'greenhouse','stripe',        'software_engineer'),
          ('Airbnb',     'greenhouse','airbnb',        'software_engineer'),
          ('Figma',      'greenhouse','figma',         'software_engineer'),
          ('Notion',     'greenhouse','notionhq',      'software_engineer'),
          ('OpenAI',     'greenhouse','openai',        'software_engineer'),
          ('Anthropic',  'greenhouse','anthropic',     'software_engineer'),
          ('Rippling',   'greenhouse','rippling',      'software_engineer'),
          ('Brex',       'greenhouse','brex',          'software_engineer'),
          ('Duolingo',   'greenhouse','duolingo',      'software_engineer'),
          ('Scale AI',   'greenhouse','scaleai',       'software_engineer'),
          ('Ramp',       'lever',     'ramp',          'software_engineer'),
          ('Mercury',    'lever',     'mercury',       'software_engineer'),
          ('Retool',     'lever',     'retool',        'software_engineer'),
          ('Linear',     'ashby',     'linear',        'software_engineer'),
          ('Vercel',     'ashby',     'vercel',        'software_engineer');
      `,
    },
    {
      id: "057_scraped_jobs_buckets",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN bucket_role      TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN bucket_seniority TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN bucket_domain    TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN direct_apply     INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE scraped_jobs ADD COLUMN source_label     TEXT;
      `,
    },
    {
      id: "058_scraped_jobs_via",
      sql: `ALTER TABLE scraped_jobs ADD COLUMN via TEXT;`,
    },
    {
      // Adds collar + confidence columns to scraped_jobs and the rejected_jobs
      // audit table used by the blue-collar eject gate (Phase 4+).
      // ALTER TABLE ADD COLUMN runs once; idempotency is guaranteed by the
      // schema_migrations tracker (this id is never re-applied).
      // CREATE TABLE/INDEX IF NOT EXISTS are unconditionally idempotent.
      id: "059_jobs_segregation",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN collar TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN classification_confidence REAL;
        CREATE TABLE IF NOT EXISTS rejected_jobs (
          job_id      TEXT    PRIMARY KEY,
          title       TEXT,
          company     TEXT,
          source      TEXT,
          reason      TEXT,
          rejected_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_rejected_at ON rejected_jobs(rejected_at);
      `,
    },
    {
      id: "060_user_profile_extended",
      sql: `
        ALTER TABLE user_profile ADD COLUMN website_url TEXT;
        ALTER TABLE user_profile ADD COLUMN portfolio_url TEXT;
        ALTER TABLE user_profile ADD COLUMN desired_salary INTEGER;
        ALTER TABLE user_profile ADD COLUMN salary_currency TEXT;
        ALTER TABLE user_profile ADD COLUMN available_start_date TEXT;
        ALTER TABLE user_profile ADD COLUMN willing_to_relocate INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE user_profile ADD COLUMN highest_degree TEXT;
        ALTER TABLE user_profile ADD COLUMN field_of_study TEXT;
        ALTER TABLE user_profile ADD COLUMN university TEXT;
        ALTER TABLE user_profile ADD COLUMN graduation_year INTEGER;
        ALTER TABLE user_profile ADD COLUMN current_job_title TEXT;
        ALTER TABLE user_profile ADD COLUMN current_company TEXT;
        ALTER TABLE user_profile ADD COLUMN years_of_experience INTEGER;
        ALTER TABLE user_profile ADD COLUMN custom_answers TEXT NOT NULL DEFAULT '{}';
      `,
    },
    {
      id: "061_scraped_jobs_enrichment",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN normalized_title      TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN summary               TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN experience_level      TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN workplace_type        TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN valid_through         INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN salary_min_usd        INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN salary_max_usd        INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN salary_period         TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN skills_json           TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN is_h1b_sponsor        INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN requires_work_auth    INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN is_clearance_required INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN discovered_at         INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN updated_at            INTEGER;
      `,
    },
    {
      id: "062_incremental_sync",
      sql: `
        CREATE TABLE IF NOT EXISTS sync_state (
          source         TEXT    PRIMARY KEY,
          cursor         TEXT,
          last_watermark INTEGER,
          updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
        );
        ALTER TABLE scraped_jobs ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
      `,
    },
    {
      id: "063_cross_source_dedup",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN fingerprint   TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN sources_seen  TEXT;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_fingerprint ON scraped_jobs(fingerprint);
      `,
    },
    {
      id: "064_job_enrichment",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN content_hash TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN enriched_at  INTEGER;
        CREATE TABLE IF NOT EXISTS company_technographics (
          company        TEXT    NOT NULL,
          skill          TEXT    NOT NULL,
          weight         REAL    NOT NULL DEFAULT 0,
          last_seen      INTEGER NOT NULL,
          posting_count  INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (company, skill)
        );
      `,
    },
    {
      id: "065_req_uid_fingerprint_hardening",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN req_uid TEXT;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_req_uid ON scraped_jobs(req_uid);
      `,
    },
    {
      id: "066_company_org_units",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN org_unit_raw TEXT;
        CREATE TABLE IF NOT EXISTS company_org_units (
          company               TEXT    NOT NULL,
          org_unit              TEXT    NOT NULL,
          domain                TEXT,
          stacks_json           TEXT,
          seniority_json        TEXT,
          confidence            REAL    NOT NULL DEFAULT 0,
          corroboration_count   INTEGER NOT NULL DEFAULT 0,
          status                TEXT    NOT NULL DEFAULT 'proposed',
          first_seen            INTEGER NOT NULL,
          last_seen             INTEGER NOT NULL,
          source_postings_json  TEXT,
          PRIMARY KEY (company, org_unit)
        );
        CREATE INDEX IF NOT EXISTS idx_company_org_units_status ON company_org_units(company, status);
      `,
    },
    {
      id: "067_company_hiring_signals",
      sql: `
        CREATE TABLE IF NOT EXISTS company_hiring_signals (
          company               TEXT    NOT NULL,
          window_start          INTEGER NOT NULL,
          window_end            INTEGER NOT NULL,
          open_count            INTEGER NOT NULL DEFAULT 0,
          new_count             INTEGER NOT NULL DEFAULT 0,
          expired_count         INTEGER NOT NULL DEFAULT 0,
          domain_breakdown_json TEXT,
          growth_score          REAL,
          updated_at            INTEGER NOT NULL,
          PRIMARY KEY (company, window_end)
        );
        CREATE INDEX IF NOT EXISTS idx_company_hiring_signals_company ON company_hiring_signals(company);
      `,
    },
    {
      id: "068_profile_tracked_search",
      sql: `
        ALTER TABLE domain_profiles ADD COLUMN tracked_search_json TEXT;
      `,
    },
    {
      id: "069_pipeline_runs",
      sql: `
        CREATE TABLE IF NOT EXISTS pipeline_runs (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          run_kind     TEXT    NOT NULL,
          source       TEXT,
          status       TEXT    NOT NULL,
          started_at   INTEGER NOT NULL,
          finished_at  INTEGER,
          duration_ms  INTEGER,
          fetched      INTEGER NOT NULL DEFAULT 0,
          written      INTEGER NOT NULL DEFAULT 0,
          unchanged    INTEGER NOT NULL DEFAULT 0,
          merged       INTEGER NOT NULL DEFAULT 0,
          dropped      INTEGER NOT NULL DEFAULT 0,
          ejected      INTEGER NOT NULL DEFAULT 0,
          failed       INTEGER NOT NULL DEFAULT 0,
          skipped      INTEGER NOT NULL DEFAULT 0,
          expired      INTEGER NOT NULL DEFAULT 0,
          error_text   TEXT,
          details_json TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_pipeline_runs_kind_source ON pipeline_runs(run_kind, source, started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started ON pipeline_runs(started_at DESC);
      `,
    },
    {
      // Four of the seeded ATS rows in 056 were wrong. Every company below was re-probed
      // against the live provider APIs before changing anything — no slug is guessed.
      //
      //   Notion    greenhouse/notionhq -> ashby/notion       (gh 404s; ashby returns 128)
      //   OpenAI    greenhouse/openai   -> ashby/openai       (gh 404s; ashby returns 732)
      //   Vercel    ashby/vercel        -> greenhouse/vercel  (ashby board is EMPTY, gh has 83)
      //   Rippling  greenhouse/rippling -> DEACTIVATED        (404 on greenhouse, ashby AND
      //                                                        lever; no board found)
      //
      // Identities confirmed from board content, not just a 200: OpenAI's departments include
      // Research/Safety Systems/Applied AI, and Vercel's postings resolve to
      // job-boards.greenhouse.io/vercel.
      //
      // Vercel is the subtlest of the four: ashby/vercel returns HTTP 200 with zero jobs, so it
      // never raised an error and never even logged the per-company warning a 404 produces — it
      // just silently contributed nothing to the board.
      //
      // Rippling is deactivated rather than deleted or guessed. active=0 is honoured by
      // cacheJobs (`WHERE active = 1`), so it stops costing a failed request every crawl while
      // the row survives as a record to reactivate once someone finds the real board. Guessing
      // a slug is exactly the failure this codebase already learned from twice.
      //
      // Corrected forward rather than by editing 056, which has already run everywhere. Each
      // guard is narrow enough to be idempotent and to not clobber a hand-fixed row.
      id: "070_fix_dead_ats_slugs",
      sql: `
        UPDATE company_ats_list
           SET ats_type = 'ashby', ats_slug = 'openai'
         WHERE company = 'OpenAI' AND ats_type = 'greenhouse';

        UPDATE company_ats_list
           SET ats_type = 'ashby', ats_slug = 'notion'
         WHERE company = 'Notion' AND ats_type = 'greenhouse';

        UPDATE company_ats_list
           SET ats_type = 'greenhouse', ats_slug = 'vercel'
         WHERE company = 'Vercel' AND ats_type = 'ashby';

        UPDATE company_ats_list
           SET active = 0
         WHERE company = 'Rippling' AND ats_type = 'greenhouse' AND ats_slug = 'rippling';
      `,
    },
    {
      // Cleanup 5.9. refresh_log had zero writers, zero readers and zero rows — grep-verified
      // across the repo, its only mention anywhere was its own CREATE TABLE in the bootstrap
      // schema, which this release also removes. Dropping it here clears it from databases that
      // already created it. Safe: no data is lost because none was ever written.
      //
      // NOT dropped, deliberately: scrape_events. Its writer (usageTracker.trackScrape) is gone
      // in the same release, but routes/admin.js still READS it in four analytics queries, so
      // dropping it would break the admin dashboard. Those panels now report a permanent zero,
      // which is accurate rather than broken. See docs/PIPELINE_DIAGNOSIS.md §5.12.
      id: "071_drop_refresh_log",
      sql: `
        DROP TABLE IF EXISTS refresh_log;
      `,
    },
    {
      id: "072_apply_submit_guards",
      sql: `
        CREATE TABLE IF NOT EXISTS app_settings (
          key        TEXT PRIMARY KEY,
          value      TEXT,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS apply_idempotency (
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          idem_key      TEXT    NOT NULL,
          endpoint      TEXT    NOT NULL,
          status_code   INTEGER NOT NULL DEFAULT 200,
          response_json TEXT    NOT NULL,
          created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, idem_key)
        );
        ALTER TABLE apply_run_jobs ADD COLUMN answers_json TEXT;
        ALTER TABLE apply_run_jobs ADD COLUMN resume_artifact_id INTEGER;
        ALTER TABLE apply_run_jobs ADD COLUMN resume_ats_score INTEGER;
        ALTER TABLE apply_run_jobs ADD COLUMN screenshot_path TEXT;
        ALTER TABLE apply_run_jobs ADD COLUMN submit_verified INTEGER;
        ALTER TABLE apply_run_jobs ADD COLUMN submit_evidence TEXT;
      `,
    },
    {
      id: "073_apply_open_questions",
      sql: `
        ALTER TABLE apply_run_jobs ADD COLUMN open_questions_json TEXT;
      `,
    },
    {
      // Queue-then-approve. approval_mode is left NULL on existing rows deliberately: those runs
      // predate the flow and were never approved by anyone, so backfilling them to 'required' would
      // put a claim in the audit trail that is not true. NULL reads as "predates approval".
      //   'required' — the run previews only and parks each job for a human decision
      //   'auto'     — full-auto, submitted without approval (now opt-in)
      //   'approved' — this run exists BECAUSE a human approved; it submits
      // approved_from_run_job_id points at the preview row whose answers were approved, which is what
      // lets the submitting run refuse if the form has changed since.
      id: "074_apply_approval_flow",
      sql: `
        ALTER TABLE apply_runs     ADD COLUMN approval_mode TEXT;
        ALTER TABLE apply_run_jobs ADD COLUMN approved_at INTEGER;
        ALTER TABLE apply_run_jobs ADD COLUMN approved_from_run_job_id INTEGER;
      `,
    },
    {
      // Cost observability. `purpose` names the FEATURE a model call served, separately from
      // event_type — which stays exactly as it is because services/limitEnforcer.js enforces
      // per-user quotas with `WHERE event_type = ?`, so repurposing that column would silently
      // change what counts against a limit.
      //
      // Additive and nullable on purpose: every row written before this migration was recorded by
      // a call site that had no notion of purpose, and inventing one for them would put a claim in
      // the cost history that nothing verified. NULL reads as "recorded before purpose existed" —
      // routes/admin.js groups it as 'unattributed' rather than dropping it.
      //
      // The 'system' user (id 0) is what background work — enrichment, import extraction, job
      // classification, the unauthenticated standalone endpoints — is attributed to.
      // usage_events.user_id is NOT NULL REFERENCES users(id), and better-sqlite3 turns
      // foreign_keys ON by default, so a bare sentinel id with no row is REJECTED: verified by a
      // real run, where every background insert failed with "FOREIGN KEY constraint failed" and
      // the largest untracked spender stayed untracked.
      // id 0 can never collide with a real account (users.id is AUTOINCREMENT, so it starts at 1)
      // and the password hash is a literal that no hash function can produce, so it is not a
      // login. INSERT OR IGNORE keeps this migration safe to re-run.
      id: "075_usage_events_purpose",
      sql: `
        ALTER TABLE usage_events ADD COLUMN purpose TEXT;
        CREATE INDEX IF NOT EXISTS idx_usage_events_purpose
          ON usage_events(purpose, created_at);
        INSERT OR IGNORE INTO users (id, username, password_hash, is_admin)
          VALUES (0, 'system', '!unusable', 0);
      `,
    },
    {
      // Persisted tracking failures. The in-process counters added with 075 reset on restart, so
      // a failure that happened and was then followed by a deploy left no trace at all: the cost
      // panel would report healthy coverage for a gap that really occurred.
      //
      // user_id carries NO foreign key, deliberately. The first real run of the wrapper failed
      // with "FOREIGN KEY constraint failed" on usage_events.user_id — an FK violation is one of
      // the reasons a usage insert fails, so putting an FK here would make the failure record
      // itself fail for exactly the cases most worth recording. Every column except created_at is
      // nullable for the same reason: a partial record beats no record.
      //
      // This still cannot capture a database that is entirely unreachable — that case degrades to
      // the in-process counter and the error log, and routes/admin.js says so rather than
      // implying the persisted count is complete.
      id: "076_usage_tracking_failures",
      sql: `
        CREATE TABLE IF NOT EXISTS usage_tracking_failures (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          model TEXT,
          purpose TEXT,
          user_id INTEGER,
          error_text TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_usage_tracking_failures_created
          ON usage_tracking_failures(created_at);
      `,
    },
    {
      // Distinguishes a failure recorded LIVE from one recovered out of the out-of-process sink
      // (services/trackingFailureSink.js) after the database came back. Conflating them would hide
      // the more serious fact: a sink-recovered row means the database itself was unreachable at
      // the time, not merely that one insert was rejected.
      //
      // Nullable: rows written by 076 predate the distinction, and NULL reads as "recorded live,
      // before this column existed" rather than being backfilled with a claim nothing verified.
      id: "077_tracking_failure_source",
      sql: `
        ALTER TABLE usage_tracking_failures ADD COLUMN source TEXT;
      `,
    },
    {
      // Automation tier — what the candidate will face at the apply destination, decided at
      // browse time. services/jobs/automationTier.js owns the mapping; this column stores its
      // output so services/jobs/jobQuery.js can filter on it in SQL. Deriving it at read time
      // instead would force that mapping to be re-expressed as a CASE expression here, and a
      // second copy of a mapping is exactly what left model ids half-migrated across the
      // codebase.
      //
      // NULLABLE, AND NOT BACKFILLED BY THIS MIGRATION — deliberately. The backfill needs
      // deriveAutomationTier(), which is JavaScript; writing it as a SQL CASE would create the
      // duplicate this column exists to avoid. Existing rows are populated instead by the
      // boot-time backfill immediately below this runner and by
      // scripts/recomputeAutomationTier.js, both of which call that one function.
      //
      // So NULL is a state the board must survive: it means "written before this column
      // existed and not yet recomputed", which is indistinguishable from 'unknown' as far as
      // any promise to the user goes. jobQuery.js's tiers_include/tiers_exclude therefore
      // COALESCE it to 'unknown' rather than letting `NULL IN (...)` (which is NULL, not
      // false) silently drop the row from BOTH directions of the filter.
      id: "078_scraped_jobs_automation_tier",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN automation_tier TEXT;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_automation_tier
          ON scraped_jobs(automation_tier, is_active);
      `,
    },
    {
      // The prepared packet for a gated portal (docs/GATED_HANDOFF_ARCHITECTURE.md §3 step 3). A run
      // that hits a login wall or a CAPTCHA cannot finish on the server, so everything already
      // decided is parked here for the human who will cross that gate, and handed to the extension
      // in exchange for a single-use token.
      //
      // expected_origin is stored SEPARATELY from apply_url rather than derived at read time. It is
      // the value the extension target-matches before releasing anything, and this packet carries a
      // home address and work-authorization answers — so the thing being compared has to be a stored
      // fact, decided once when the run observed the gate, not a re-parse of a URL that may have been
      // rewritten since.
      //
      // token_hash, not the token: a database read must not yield a usable credential. The token
      // exists only in the response that mints it. consumed_at is what makes it single-use, and it is
      // set in the same statement that claims the packet, so two concurrent exchanges cannot both win.
      //
      // exchange_attempts counts every attempt including rejected ones, so a packet being probed is
      // visible on the row itself and not only in the log.
      id: "079_apply_gate_packets",
      sql: `
        CREATE TABLE IF NOT EXISTS apply_gate_packets (
          id                 INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          run_id             INTEGER,
          run_job_id         INTEGER REFERENCES apply_run_jobs(id) ON DELETE CASCADE,
          job_id             TEXT    NOT NULL,
          apply_url          TEXT    NOT NULL,
          expected_origin    TEXT    NOT NULL,
          gate_reason        TEXT    NOT NULL,
          answers_json       TEXT    NOT NULL,
          resume_artifact_id INTEGER,
          token_hash         TEXT    NOT NULL UNIQUE,
          expires_at         INTEGER NOT NULL,
          consumed_at        INTEGER,
          exchange_attempts  INTEGER NOT NULL DEFAULT 0,
          created_at         INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_gate_packets_user_job
          ON apply_gate_packets(user_id, job_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_gate_packets_origin
          ON apply_gate_packets(user_id, expected_origin, consumed_at);
      `,
    },
    {
      // What a human actually saw before an application went out (TASK G3, §4's review-as-provenance).
      // The audit trail already records what was ANSWERED and with what provenance; this records what
      // was REVIEWED — which fields the candidate approved as-is, which they corrected, and which
      // low-confidence guesses they had to acknowledge before the overlay would call itself ready.
      //
      // Separate from answers_json rather than merged into it: those are two different claims made at
      // two different times by two different parties, and collapsing them would make it impossible to
      // say afterwards whether a value was the resolver's or the candidate's. For a gated application
      // this is the ONLY record of human review, because the submission itself happens in a browser we
      // never see.
      //
      // Nullable, not backfilled: a NULL means the application predates the overlay or was never
      // reviewed through it, which is not the same as "reviewed and nothing changed".
      id: "080_apply_gate_review",
      sql: `
        ALTER TABLE apply_run_jobs ADD COLUMN gate_review_json TEXT;
      `,
    },
    {
      // A company's application form, as a KB fact (TASK G4). Behind a gate is a place the server
      // can never reach, but the extension is standing inside it — so the form's STRUCTURE comes
      // back and the next candidate's packet arrives pre-mapped. It is the mechanism that replaces
      // hand-writing platformDetector's PLATFORM_LABEL_MAPS one ATS at a time.
      //
      // KEYED BY APPLY HOST, not by job. One careers page serves every posting behind it, so a
      // schema captured once from any of them serves all the others — which is the only reason this
      // compounds rather than being a per-application cache.
      //
      // STRUCTURE ONLY. fields_json holds labels, types, required flags, option lists and order.
      // Never a value, never anything about the candidate. discoverFields returns current_value and
      // this store must never receive it, which is enforced by a whitelist in formSchemaLayer.js and
      // asserted by test rather than promised by a comment.
      //
      // shape_hash is what makes a CHANGED form observable. Forms change; a stale schema that is
      // trusted is worse than no schema, so a differing hash is treated as a new claim about the
      // form — corroboration resets and a confirmed schema drops back to proposed. That last part
      // deliberately DIVERGES from company_org_units, which never demotes: an org unit that stops
      // appearing may simply not be hiring, whereas a form that comes back different is positive
      // evidence the stored one is now wrong.
      //
      // `source` distinguishes a capture made by a candidate standing behind a gate from one our own
      // crawl of a public careers page produced. Both write the same shape on purpose — this is the
      // store imported-careers-page support needs too, and a gated-only variant would have to be
      // merged into it later.
      //
      // users.form_schema_capture is the consent switch, DEFAULT 0. Capture reports on a page behind
      // that candidate's own authenticated session, and opt-in is the only answer to "what does it
      // send from behind my login?" that does not rest on trusting our filter.
      id: "081_company_form_schemas",
      sql: `
        CREATE TABLE IF NOT EXISTS company_form_schemas (
          apply_host           TEXT    NOT NULL PRIMARY KEY,
          company              TEXT,
          platform             TEXT,
          fields_json          TEXT    NOT NULL,
          field_count          INTEGER NOT NULL DEFAULT 0,
          unmapped_json        TEXT,
          unmapped_count       INTEGER NOT NULL DEFAULT 0,
          shape_hash           TEXT    NOT NULL,
          confidence           REAL    NOT NULL DEFAULT 0,
          corroboration_count  INTEGER NOT NULL DEFAULT 0,
          status               TEXT    NOT NULL DEFAULT 'proposed',
          source               TEXT    NOT NULL,
          first_seen           INTEGER NOT NULL,
          last_seen            INTEGER NOT NULL,
          changed_at           INTEGER,
          previous_shape_hash  TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_company_form_schemas_company
          ON company_form_schemas(company, status);
        ALTER TABLE users ADD COLUMN form_schema_capture INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      // H-1B sponsorship as a COMPANY fact, from DOL/OFLC LCA disclosure data (TASK X3).
      //
      // WHY THIS IS NOT ON scraped_jobs. The posting-level is_h1b_sponsor experiment is over and it
      // failed on the evidence: of 1,261 postings, 0 mention "H-1B", 36 mention sponsorship at all,
      // and the LLM backfill produced 3 non-null values, all false. The signal is not in the source
      // material. Every H-1B-sponsoring employer, by contrast, MUST file a Labor Condition
      // Application, and those filings are public and quarterly. So this is a fact the company emits
      // about itself, and it belongs beside company_technographics and company_org_units.
      //
      // is_h1b_sponsor SURVIVES UNCHANGED and is not populated from here. Two different claims:
      // "this employer filed 47 petitions last quarter" is not "this role sponsors". Nothing in this
      // migration touches scraped_jobs, by design and by test
      // (test/lcaPostingFlagUntouched.test.js).
      //
      // THREE TABLES, because they answer to three different owners:
      //
      //   lca_source_files     — the import ledger. One row per quarterly file, so a re-import
      //                          RECONCILES (delete-then-insert that period) instead of doubling
      //                          the counts, same discipline as the job pipeline's req_uid.
      //   lca_employer_periods — LCA employers as filed, one row per (employer, FEIN, quarter).
      //                          Keeping the whole employer universe rather than only the companies
      //                          we happen to know today is what lets a company added tomorrow be
      //                          matched without re-downloading ~2 GB of spreadsheets.
      //   company_lca_sponsorship — the derived KB fact for one of OUR company strings, carrying
      //                          the match tier and confidence, provenance and last_seen like every
      //                          other KB store.
      //
      // fein is NOT NULL with a '' sentinel rather than nullable: it is in a PRIMARY KEY, and SQLite
      // permits NULLs in a non-INTEGER primary key, which would silently stop de-duplicating the
      // rows this table exists to de-duplicate.
      //
      // match_status is the integrity mechanism, not decoration. 'ambiguous' means two or more
      // distinct FEINs answer to the same brand name (measured: 2.3% of reachable brands — Mercury
      // Insurance vs Mercury Technologies, and Mercury Insurance also files for "Senior Software
      // Engineer", so no title heuristic can separate them). An 'ambiguous' row renders NOTHING —
      // not a zero, not "no data" — because a wrong sponsor claim is worse than a missing one.
      //
      // periods_covered vs periods_with_filings is how staleness stays honest. Quora filed 1
      // certified LCA in FY2025 Q4 and 0 in FY2026 Q1; a single-quarter snapshot cannot tell "does
      // not sponsor" from "did not file last quarter", so the store records how many quarters were
      // SEARCHED alongside how many had filings, and latest_period carries the recency the UI
      // decays against.
      id: "082_company_lca_sponsorship",
      sql: `
        CREATE TABLE IF NOT EXISTS lca_source_files (
          file_name       TEXT    NOT NULL PRIMARY KEY,
          fiscal_period   TEXT    NOT NULL,
          fiscal_year     INTEGER NOT NULL,
          fiscal_quarter  INTEGER NOT NULL,
          period_start    INTEGER,
          period_end      INTEGER,
          sheet_rows      INTEGER NOT NULL DEFAULT 0,
          case_rows       INTEGER NOT NULL DEFAULT 0,
          employer_rows   INTEGER NOT NULL DEFAULT 0,
          byte_size       INTEGER,
          source_url      TEXT,
          ingested_at     INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS lca_employer_periods (
          employer_key    TEXT    NOT NULL,
          fein            TEXT    NOT NULL,
          fiscal_period   TEXT    NOT NULL,
          employer_name   TEXT    NOT NULL,
          dba_keys_json   TEXT,
          state           TEXT,
          certified       INTEGER NOT NULL DEFAULT 0,
          denied          INTEGER NOT NULL DEFAULT 0,
          withdrawn       INTEGER NOT NULL DEFAULT 0,
          positions       INTEGER NOT NULL DEFAULT 0,
          top_titles_json TEXT,
          last_decision   INTEGER,
          PRIMARY KEY (employer_key, fein, fiscal_period)
        );
        CREATE INDEX IF NOT EXISTS idx_lca_employer_periods_key
          ON lca_employer_periods(employer_key);
        CREATE INDEX IF NOT EXISTS idx_lca_employer_periods_period
          ON lca_employer_periods(fiscal_period);
        CREATE TABLE IF NOT EXISTS company_lca_sponsorship (
          company              TEXT    NOT NULL PRIMARY KEY,
          match_status         TEXT    NOT NULL,
          match_tier           TEXT,
          match_confidence     REAL    NOT NULL DEFAULT 0,
          match_key            TEXT,
          match_reason         TEXT,
          matched_entities_json TEXT,
          candidate_count      INTEGER NOT NULL DEFAULT 0,
          certified_total      INTEGER NOT NULL DEFAULT 0,
          denied_total         INTEGER NOT NULL DEFAULT 0,
          positions_total      INTEGER NOT NULL DEFAULT 0,
          by_period_json       TEXT,
          by_fiscal_year_json  TEXT,
          top_titles_json      TEXT,
          latest_period        TEXT,
          latest_filing_at     INTEGER,
          periods_covered      INTEGER NOT NULL DEFAULT 0,
          periods_with_filings INTEGER NOT NULL DEFAULT 0,
          source               TEXT    NOT NULL DEFAULT 'dol_oflc_lca',
          provenance_json      TEXT,
          first_seen           INTEGER NOT NULL,
          last_seen            INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_company_lca_sponsorship_status
          ON company_lca_sponsorship(match_status, certified_total);
      `,
    },
    {
      // The OFLC record layout CHANGED, and the corpus has to be able to say where (TASK X3).
      //
      // EMPLOYER_FEIN does not exist in the FY2021, FY2022 or FY2023 disclosure files. Those sheets
      // are 96 columns with no employer tax ID anywhere in them; FY2024 Q1 onward is 98 columns with
      // it. That matters because FEIN is what services/kb/lcaMatch.js counts to decide whether a
      // brand-prefix (tier C) match is unambiguous — and counting FEINs over a file that has none
      // returns zero, which would have read as "one employer" and switched the ambiguity guard OFF
      // for twelve of the twenty-one available quarters. countDistinctEntities() falls back to
      // counting distinct legal names instead, which is strictly more cautious.
      //
      // Stored rather than derived. It IS derivable ("do all this period's rows have fein = ''?"),
      // but a derived answer cannot distinguish a file that had no FEIN column from a file whose
      // FEIN column happened to be empty, and the second would be a parser bug we would want to see
      // rather than absorb. One column in the import ledger, written from the header row itself.
      //
      // Nullable with no default: rows written before this migration predate the check and must not
      // claim either answer. Re-running the ingester for those periods fills them in.
      id: "083_lca_source_fein_presence",
      sql: `
        ALTER TABLE lca_source_files ADD COLUMN has_employer_fein INTEGER;
      `,
    },
    {
      // OFLC CHANGED WHAT A QUARTERLY FILE MEANS, and the corpus has to survive both conventions
      // (TASK X3). Measured from the decision dates in the files themselves:
      //
      //   FY2021 Q1   2020-10-01 → 2020-12-31     one quarter
      //   FY2021 Q2   2020-10-01 → 2021-03-31     TWO quarters — contains Q1
      //   FY2021 Q3   2020-10-01 → 2021-06-30     THREE quarters — contains Q2
      //   FY2025 Q1   2024-10-01 → 2024-12-31     one quarter
      //   FY2025 Q2   2025-01-01 → 2025-03-31     one quarter — disjoint from Q1
      //
      // The old files are FISCAL-YEAR CUMULATIVE; the new ones are per-quarter. Migration 082's
      // ingester summed across periods on the strength of the FY2025/FY2026 evidence, which is
      // correct there and TRIPLE-COUNTS FY2021 Q1. Nothing about the filename says which convention
      // a file follows, so the ingester now derives each file's true window from its own decision
      // dates and drops any period whose window is contained in another's.
      //
      // quarters_covered is that window expressed in quarters, and it is stored because two things
      // need it and neither can recompute it: periods_covered ("how long did we look?") must count
      // QUARTERS rather than files, or a four-year corpus reports as nine; and the per-period chips
      // must not label a full fiscal year "FY2021 Q4", which would claim a year's filings happened
      // in one quarter.
      //
      // Nullable: rows written before this migration have not had their window measured, and
      // guessing 1 would silently reassert the bug this exists to fix.
      id: "084_lca_period_span",
      sql: `
        ALTER TABLE lca_source_files ADD COLUMN quarters_covered INTEGER;
      `,
    },
    {
      // TASK AC4: a USER-SIDE DELETE that is a soft hide, and the index the dated history reads on.
      //
      // WHY SOFT, AND WHY FOR EVERYTHING. The requirement asks for the decision to be made and
      // stated. A submitted application is evidence that reached a real employer; that record is
      // exactly what the candidate needs when an interview lands three weeks later, and a hard
      // delete would destroy it on a click made while tidying up. So submitted rows are never
      // hard-deleted — and rather than two code paths, NOTHING is: `hidden_at` is set on any row
      // the user removes, and every user-facing feed filters it out. Three things fall out of that
      // which a DELETE would have cost:
      //
      //   - apply_job_logs.run_job_id and apply_gate_packets.run_job_id both cascade on DELETE, so
      //     hard-deleting one run-job would silently take its whole audit trail and its prepared
      //     handoff with it.
      //   - apply_runs.submitted_count / held_count / failed_count are stored counters, not
      //     derived. Removing a row would leave the run claiming work that no longer exists.
      //   - It is reversible. `UPDATE apply_run_jobs SET hidden_at=NULL` restores anything an
      //     operator is asked to restore; a DELETE is a support ticket that cannot be answered.
      //
      // Nullable with no default and no backfill: NULL means visible, which is what every existing
      // row is. A row written before this migration cannot have been hidden.
      //
      // The index is what makes the dated view a lookup rather than a scan. AC4 requirement 5 says
      // the history must be date-scoped AND user-scoped on the SERVER — "do not fetch all history
      // and filter client-side" — and (user_id, created_at) is the exact shape of that query. The
      // existing idx_apply_run_jobs_user_status leads with status, so it cannot serve a date range.
      id: "085_apply_run_jobs_hidden",
      sql: `
        ALTER TABLE apply_run_jobs ADD COLUMN hidden_at INTEGER;
        CREATE INDEX IF NOT EXISTS idx_apply_run_jobs_user_created
          ON apply_run_jobs(user_id, created_at);
      `,
    },
    {
      // The sponsorship SITUATION, replacing a stored ANSWER. `requires_sponsorship` is one
      // boolean, and the standard Greenhouse question is "do you NOW OR IN THE FUTURE require
      // sponsorship" — two tenses that disagree for anyone on a time-limited status. An F-1 STEM
      // OPT candidate needs no sponsorship today and will need H-1B when OPT expires, so the
      // boolean answered the future-tense question "No": a false material attestation, submitted
      // at confidence 1.0. See docs/auto-apply-a5-live-run.md §4.1.
      //
      // NULLABLE ON PURPOSE, with no default. 'none' is not a safe default — it is precisely the
      // wrong guess for the population this exists to protect — and resolveSponsorshipNeed refuses
      // (holding the run for a human) rather than inventing a situation it cannot derive. The
      // legacy boolean is left in place: it still answers the present tense, and it is what the
      // derivation falls back to.
      id: "086_user_profile_sponsorship_need",
      sql: `
        ALTER TABLE user_profile ADD COLUMN sponsorship_need TEXT;
      `,
    },
    {
      // Per-company overrides for a `{company}`-templated custom answer (AF1).
      //
      // A separate column rather than a reserved key inside custom_answers, because buildAnswers
      // iterates that map's values and stringifies them: a nested object there would be typed into
      // a real employer's form as "[object Object]". Shape is {companyKey: {question: answer}}.
      id: "087_user_profile_answer_overrides",
      sql: `
        ALTER TABLE user_profile ADD COLUMN custom_answer_overrides TEXT NOT NULL DEFAULT '{}';
      `,
    },
    {
      // AF5's campaign record. Two facts a semi run already had in hand and threw away:
      //
      //   fields_discovered — the DENOMINATOR for discovery reliability. answers_json says what was
      //     resolved; without the count of what was FOUND, "12 fields filled" cannot be read as good
      //     or bad, and per-ATS discovery reliability is not computable at all.
      //   corrections_json — what the HUMAN changed after the resolver filled it. Each entry is
      //     either a resolver defect or a missing custom answer, which makes this the most valuable
      //     output of a semi run and the one thing nothing recorded.
      id: "088_apply_run_jobs_campaign_record",
      sql: `
        ALTER TABLE apply_run_jobs ADD COLUMN fields_discovered INTEGER;
        ALTER TABLE apply_run_jobs ADD COLUMN corrections_json TEXT;
      `,
    },
    {
      // profile_signal_suggestions.status was doing two independent jobs at once.
      //
      //   QUEUE      is this skill queued for the base-resume enhancement rewrite?
      //   ASSERTION  has the candidate said this is true of them?
      //
      // One column cannot hold two orthogonal facts, so every value crowded out the others.
      // 'claimed' (added by AG2) and 'applied' had to pretend they were not queued, and
      // syncSelectedSkillSuggestions — which reconciles the QUEUE — reconciled the whole column and
      // silently withdrew claims it had never heard of. That was patched by teaching it which
      // values to avoid, which is a guard around a modelling error rather than a fix for it. The
      // next value added would have needed the same guard, in every reader, forever.
      //
      // status is KEPT and still written, derived from the two new columns, so anything reading it
      // — an old process mid-deploy, a manual query — keeps working. It is lossy by construction:
      // a row that is both queued AND claimed can only say one of those, and assertion wins. That
      // lossiness is the whole reason for the split, so the new columns are the source of truth and
      // status is a legacy projection.
      id: "089_profile_signal_queue_and_assertion",
      sql: `
        ALTER TABLE profile_signal_suggestions ADD COLUMN queue_state TEXT NOT NULL DEFAULT 'none';
        ALTER TABLE profile_signal_suggestions ADD COLUMN assertion TEXT NOT NULL DEFAULT 'none';
        ALTER TABLE profile_signal_suggestions ADD COLUMN claimed_at INTEGER;
        UPDATE profile_signal_suggestions SET queue_state = 'queued' WHERE status = 'selected';
        UPDATE profile_signal_suggestions SET assertion = 'applied' WHERE status = 'applied';
        UPDATE profile_signal_suggestions
           SET assertion = 'claimed', claimed_at = selected_at, selected_at = NULL
         WHERE status = 'claimed';
        CREATE INDEX IF NOT EXISTS idx_profile_signal_suggestions_axes
          ON profile_signal_suggestions(profile_id, signal_kind, queue_state, assertion, frequency DESC);
      `,
    },
    {
      // AH1 root cause: signing out did not sign you out.
      //
      // /api/auth/logout revoked the presenting tab's auth-context token and RETURNED EARLY,
      // leaving the connect.sid session — the durable, 7-day, rolling credential — alive in
      // sessions.db. Any request without a token then re-authenticated off that cookie, and a new
      // tab sends no token because sessionStorage is per-tab and starts empty. That is the
      // long-standing "a hard refresh auto-authenticates" report: not a refresh bug, a sign-out
      // that only ever signed out one tab's fallback credential.
      //
      // Revoking the browser's tokens on sign-out means knowing WHICH browser a token belongs to,
      // so one browser profile signing out cannot revoke another's. session_sid is the connect.sid
      // the context was issued under.
      //
      // NULL session_sid means either a row predating this migration or a deliberately
      // session-less credential (the extension token, which the user revokes separately via
      // /api/auth/revoke-extension-token). Neither is swept by a browser sign-out — a sign-out
      // revokes the presented token plus its session siblings, never an unattributable row.
      id: "090_auth_context_session_binding",
      sql: `
        ALTER TABLE auth_contexts ADD COLUMN session_sid TEXT;
        CREATE INDEX IF NOT EXISTS idx_auth_contexts_session
          ON auth_contexts(session_sid, revoked_at);
      `,
    },
    {
      // AH5. Two columns, for the two halves of "say what happened".
      //
      // apply_run_jobs.blanks_json — every discovered field the run did NOT fill, with why
      //   (low_confidence / no_answer / unmatched / fill_failed). Read off the POST-FILL discovery
      //   pass, so it is the state of the form and not a gate's opinion of it. answers_json has
      //   always held the filled half with its provenance; the blank half had nowhere to live, so a
      //   run could say "Autofilled 7 fields" and hold for review with no way to learn which 7 or
      //   what was still empty. missingRequired existed but only inside an apply_job_logs event,
      //   which no surface reads.
      //
      // resumes.domain_profile_id — which job profile an artifact was generated under.
      //   processRunJob reuses any `resumes` row for (user, job), newest first, and that is the
      //   right instinct: regenerating work already done costs a model call and minutes of the
      //   candidate's time. But with no record of the profile it also reuses an artifact built for
      //   a DIFFERENT profile, and there was no way to tell. Stamping it makes "is this current?"
      //   a question the code can answer instead of assume. NULL means an artifact written before
      //   this migration, and the reuse rule treats that as unknown-but-usable rather than
      //   forcing a regeneration of every existing artifact.
      id: "091_fill_log_and_artifact_provenance",
      sql: `
        ALTER TABLE apply_run_jobs ADD COLUMN blanks_json TEXT;
        ALTER TABLE resumes ADD COLUMN domain_profile_id INTEGER;
        CREATE INDEX IF NOT EXISTS idx_resumes_currency
          ON resumes(user_id, job_id, domain_profile_id, updated_at DESC);
      `,
    },
    {
      // AI1. The summary section becomes a per-profile choice, and its default is OFF.
      //
      // WHY A COLUMN AND NOT A SETTINGS BLOB
      // domain_profiles has no settings JSON to extend — every preference on it is its own typed
      // column (seniority, target_titles, selected_*). A blob added for one boolean would be the
      // odd one out and the first place a later setting hid from a query.
      //
      // DEFAULT 0 CHANGES WHAT EXISTING USERS GET, ON PURPOSE, AND THE UI SAYS SO.
      // Every resume generated before this had a summary, so a default of 0 means the next resume
      // an existing candidate generates will not. Backfilling 1 for existing rows was the other
      // option and was rejected: it would leave two populations with different defaults and no way
      // to tell them apart, and the product decision is that a summary is opt-in for everyone.
      // The cost of the change is a section the candidate can turn back on in one click; the cost
      // of hiding it is a resume that silently differs from the last one they read. So the toggle
      // states in the UI that it changes the next generated resume, rather than leaving it found.
      id: "092_profile_summary_opt_in",
      sql: `
        ALTER TABLE domain_profiles ADD COLUMN include_summary INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      // AK1. Corpus-derived term weights for the local ATS scorer.
      //
      // WHY A TABLE AND NOT A JSON FILE ON DISK
      // The weights are DERIVED FROM scraped_jobs and go stale as the board is re-scraped. A file
      // checked into data/ would be a snapshot of one machine's board pretending to be a constant,
      // and every other deployment would score against a corpus it does not have. The table is
      // recomputed from whatever board the deployment actually holds.
      //
      // computed_at AND corpus_size ARE NOT DECORATION.
      // A weight table that ages silently is this project's most repeated defect shape, so the
      // provenance is stored per row and the loader refuses weights older than
      // MAX_WEIGHT_AGE_DAYS rather than scoring against a corpus that no longer exists. corpus_size
      // is stored too because a weight is only interpretable against the N it was derived from.
      //
      // NO FOREIGN KEY TO scraped_jobs, ON PURPOSE. Rows here are aggregates over the whole corpus,
      // not facts about one posting; a deleted job must not delete a weight, it must wait for the
      // next recompute.
      id: "093_ats_term_weights",
      sql: `
        CREATE TABLE IF NOT EXISTS ats_term_weights (
          role_family TEXT    NOT NULL,
          term        TEXT    NOT NULL,
          df          INTEGER NOT NULL,
          corpus_size INTEGER NOT NULL,
          weight      REAL    NOT NULL,
          computed_at INTEGER NOT NULL,
          PRIMARY KEY (role_family, term)
        );
        CREATE INDEX IF NOT EXISTS idx_ats_term_weights_family
          ON ats_term_weights(role_family);
      `,
    },
    {
      // AK1 — record the ATS score AT THE MOMENT OF APPLYING, so it can be correlated with the
      // outcome later.
      //
      // THIS IS THE ONLY HONEST TEST OF WHETHER THE SCORE PREDICTS ANYTHING, AND IT IS
      // UNRECOVERABLE IF NOT CAPTURED AT THE TIME. Nobody can compute a true ATS score; the number
      // is defensible only if applications that scored higher actually get more responses. That
      // question needs (score, outcome) pairs, and the score half cannot be reconstructed
      // afterwards — the resume changes, the profile changes, the corpus weights change, and the
      // scorer itself changes. Re-scoring an old application next year answers a different
      // question. n is ZERO today and no claim is being made from this; the fields exist so the
      // data starts accumulating from the next application onward.
      //
      // ats_scorer_version IS NOT OPTIONAL, and AK1 is the proof. This very change moved the scale:
      // the same fit that scored 45 under local_ats_v3 scores about 28 under v4, because skills went
      // from 50 to 70 points, experience stopped being a cliff, and constraints stopped paying for
      // the absence of a problem. Pooling scores across that boundary without knowing which scorer
      // produced them would silently mix two scales and produce a confident, meaningless
      // correlation. Every stored score carries the version that produced it.
      //
      // The full report is stored beside the number because "which TERMS were missing when this
      // application got a response" is the more useful question, and it is the one targeted
      // generation (Phase 4) would be tuned against.
      id: "094_application_ats_provenance",
      sql: `
        ALTER TABLE job_applications ADD COLUMN ats_score_at_apply INTEGER;
        ALTER TABLE job_applications ADD COLUMN ats_scorer_version TEXT;
        ALTER TABLE job_applications ADD COLUMN ats_report_at_apply TEXT;
        ALTER TABLE job_applications ADD COLUMN ats_scored_at INTEGER;
        CREATE INDEX IF NOT EXISTS idx_job_applications_ats_score
          ON job_applications(ats_scorer_version, ats_score_at_apply);
      `,
    },
    {
      // AK1 — the other half of the pair: what the EMPLOYER did.
      //
      // 094 made the ATS score at the moment of applying recordable. That is one half. Without what
      // came back, the score can never be validated against anything, and validating it is the only
      // honest test of a number nobody can compute exactly. See shared/applicationResponse.js for
      // the vocabulary and for why this is a different axis from shared/applyOutcomeGroups.js —
      // that one says whether WE managed to submit, this one says whether THEY replied.
      //
      // THREE COLUMNS, NOT ONE, BECAUSE THEY ANSWER THREE QUESTIONS AND NONE DERIVES FROM ANOTHER:
      //
      //   first_response_at  Did they engage at all, and how fast? Set ONCE, never moved. This is
      //                      the column the ATS score should actually be correlated against — a
      //                      resume screening score can plausibly predict "did you get a reply",
      //                      and has no business predicting whether you got the job.
      //   furthest_stage     How far did it get? Monotonic. An application that goes screen ->
      //                      interview -> rejected must not read as though it were rejected off the
      //                      resume; the interview is the most informative fact on the row and a
      //                      single current-state column would erase it.
      //   response_outcome   How did it end? The current disposition.
      //
      // NULL IS NOT "NO RESPONSE". An application sent yesterday with nothing recorded is
      // UNRESOLVED, not a negative — counting it as silence biases every early response-rate toward
      // zero, which is exactly when someone will first look at this and conclude the resume is bad.
      // MATURITY_DAYS in the shared module is what separates the two, and the analysis query
      // applies it rather than trusting NULL.
      id: "095_application_response_outcome",
      sql: `
        ALTER TABLE job_applications ADD COLUMN response_outcome TEXT;
        ALTER TABLE job_applications ADD COLUMN furthest_stage TEXT;
        ALTER TABLE job_applications ADD COLUMN first_response_at INTEGER;
        ALTER TABLE job_applications ADD COLUMN outcome_at INTEGER;
        ALTER TABLE job_applications ADD COLUMN outcome_source TEXT;
        CREATE INDEX IF NOT EXISTS idx_job_applications_response
          ON job_applications(user_id, response_outcome, applied_at);
      `,
    },
    {
      // AL1 — which PROVIDER served each call, alongside the model that already exists.
      //
      // WHY MODEL ALONE IS NOT ENOUGH. It nearly is — model IDs are globally unique in practice, so
      // "llama-3.1-8b-instant" could only have come from Groq today. But the cost report groups by
      // model and the whole point of the tracking work was that a report which silently omits part
      // of the traffic is worse than no report. The moment the same open-weights model is served by
      // two providers (which is the normal case for Llama — Groq, Together, SambaNova and Fireworks
      // all serve it), a model-only column makes two different tiers with two different prices and
      // two different data policies indistinguishable in the one table that is supposed to be the
      // record of what was sent where.
      //
      // BACKFILLED TO 'anthropic' RATHER THAN LEFT NULL. Every row that exists before this
      // migration was an Anthropic call — there was no other path. A NULL would say "unknown",
      // which is a different and false claim, and it would make the honest query
      // (`GROUP BY provider`) grow a bucket that never corresponded to anything.
      id: "096_usage_events_provider",
      sql: `
        ALTER TABLE usage_events ADD COLUMN provider TEXT;
        UPDATE usage_events SET provider = 'anthropic' WHERE provider IS NULL;
        CREATE INDEX IF NOT EXISTS idx_usage_events_provider
          ON usage_events(provider, created_at);
      `,
    },
    {
      // AL2 — generation is deferred to APPROVAL, and the free base-resume fit is recorded instead.
      //
      // WHY. Generation costs ~$0.04 on Sonnet and fired at QUEUE time. A swipe is ~1 second, so
      // five idle minutes of swiping is ~60 jobs and ~$2.40 spent by a gesture that cost the user
      // no thought at all. Nothing was decided at that point — the user had not seen the
      // application and had not approved sending it.
      //
      // A USER CANNOT APPROVE BLIND, which is why this is three columns and not a feature flag.
      // scoreAtsLocally runs with NO model call and NO generated artifact, so the approval screen
      // can show a real fit band computed against the BASE resume, for free, before anything is
      // spent. That is also a MORE HONEST number than the one it replaces: the old score was
      // computed against the GENERATED resume, so it reflected tailoring the user had not yet
      // decided to pay for. A base-resume band is an honest floor — tailoring can only raise it.
      //
      //   generate_at_queue  per-profile, DEFAULT 0 (off). Restores the old behaviour for testing.
      //                      On domain_profiles beside include_summary (092), because it is the
      //                      same kind of thing: a per-profile choice about what a run does.
      //   base_ats_score     the free score, INTEGER and nullable — NULL is the scorer DECLINING,
      //                      which is not a zero and must never render as one.
      //   base_ats_json      the matched/missing terms behind it, so the approval screen can say
      //                      WHY rather than showing a bare number the user cannot check.
      id: "097_generation_deferred_to_approval",
      sql: `
        ALTER TABLE domain_profiles ADD COLUMN generate_at_queue INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE apply_run_jobs ADD COLUMN base_ats_score INTEGER;
        ALTER TABLE apply_run_jobs ADD COLUMN base_ats_json TEXT;
      `,
    },
    {
      // AL3 (G1) — the skill synonym table: the ONLY thing on the horizon that moves rho UPWARD.
      //
      // THE MEASURED CEILING IT ATTACKS. AK1's worst inversion was -19 ranks: a reliability role
      // whose JD said "log analysis" where the resume said "observability tooling". AK1 called that
      // "a ceiling on the approach, not a bug" — the scorer matches terms, and two names for one
      // skill are two terms. Everything else queued moves rho sideways.
      //
      // ⛔ WHY status IS HERE AND DEFAULTS TO 'proposed'. A FALSE EQUIVALENCE IS A CONFIDENTLY
      // WRONG MATCH, which is the failure mode that costs the most trust — the same class as the
      // "coffee machine vendor" credited with machine learning (22.8% of all multi-word matches
      // before AK1's proximity fix). An LLM proposing "kubernetes ~ docker" is plausible-sounding
      // and wrong, and it would silently inflate scores on every posting mentioning either. So the
      // scorer reads ONLY 'confirmed' rows, promotion is a human act, and corroboration alone can
      // never promote. This is deliberately STRICTER than company_org_units, which self-promotes at
      // 3 postings / 0.6 confidence: an org unit that is wrong is a wrong label on a card, while a
      // synonym that is wrong changes every score on the board.
      //
      // relation SEPARATES TWO DIFFERENT CLAIMS that must not be conflated:
      //   'alias'   — the same thing under another name. k8s = kubernetes, postgres = postgresql.
      //               Symmetric and safe.
      //   'related' — adjacent, not identical. log analysis ~ observability. This is the one that
      //               earns the rho and the one that produces false matches, so review is stricter.
      //
      // confidence and provenance follow services/kb/orgLayer.js exactly (corroboration_count,
      // source_postings_json, decay against last_seen) rather than inventing a second convention.
      id: "098_skill_synonyms",
      sql: `
        CREATE TABLE IF NOT EXISTS skill_synonyms (
          term                TEXT    NOT NULL,
          equivalent          TEXT    NOT NULL,
          relation            TEXT    NOT NULL DEFAULT 'related',
          confidence          REAL    NOT NULL DEFAULT 0,
          corroboration_count INTEGER NOT NULL DEFAULT 0,
          source_postings_json TEXT,
          status              TEXT    NOT NULL DEFAULT 'proposed',
          reviewed_at         INTEGER,
          reviewed_by         TEXT,
          first_seen          INTEGER,
          last_seen           INTEGER,
          updated_at          INTEGER,
          PRIMARY KEY (term, equivalent)
        );
        CREATE INDEX IF NOT EXISTS idx_skill_synonyms_status
          ON skill_synonyms(status, confidence);
        CREATE INDEX IF NOT EXISTS idx_skill_synonyms_term
          ON skill_synonyms(term, status);
      `,
    },
    {
      // AL4 (G2) — human-reviewed identity resolutions for LCA company matching.
      //
      // WHAT IS ACTUALLY UNRESOLVED, measured rather than assumed. The task described the gap as
      // "legal-entity vs brand mismatches — META PLATFORMS, INC. vs Meta". That is NOT what the
      // 6 unresolved rows are: tier A already strips legal suffixes, so those cases match. The
      // real split is
      //   3 UNMATCHED  Bolt Farm Treehouse, Epia Neuro, Physical Superintelligence — ZERO candidate
      //                employers in 144,584. There is nothing to resolve TO, and a model "finding"
      //                one would be inventing an attestation about a third party.
      //   3 AMBIGUOUS  Linear, Mercury, Ramp — real candidates that the matcher refuses to choose
      //                between. This is the only place outside knowledge can help.
      //
      // ⛔ WHY A SEPARATE TABLE AND NOT A CONFIDENCE BUMP. Saying "Company A sponsors H-1Bs" when
      // the filings belong to a similarly-named Company B is a FALSE ATTESTATION ABOUT A THIRD
      // PARTY — worse than a wrong score, because it is a factual claim about someone who is not
      // the user and cannot correct it. lcaMatch.js already declines these deliberately (see the
      // Linear case in its header: "Linear Labs LLC" is an electric-motor company and Linear.app
      // has never filed). Loosening the matcher would re-open exactly that. So resolutions live
      // beside the matcher, are proposed by a model, and reach it ONLY after a human confirms.
      //
      // resolved_employer_name NULL IS A REAL ANSWER, and the most likely correct one for Linear:
      // "none of these candidates is this company". Recording it keeps the negative pinned so a
      // later pass does not re-propose the wrong entity, exactly as a rejected skill synonym stays
      // rejected.
      id: "099_lca_company_resolutions",
      sql: `
        CREATE TABLE IF NOT EXISTS lca_company_resolutions (
          company                TEXT    NOT NULL PRIMARY KEY,
          resolved_employer_name TEXT,
          resolved_match_key     TEXT,
          candidates_json        TEXT,
          model_confidence       REAL,
          model_reason           TEXT,
          status                 TEXT    NOT NULL DEFAULT 'proposed',
          reviewed_at            INTEGER,
          reviewed_by            TEXT,
          proposed_at            INTEGER,
          updated_at             INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_lca_company_resolutions_status
          ON lca_company_resolutions(status);
      `,
    },
    {
      // AL8 (H) — label to field mappings DERIVED from captured form structure.
      //
      // PLATFORM_LABEL_MAPS is hand-written for greenhouse, lever and workday; every other ATS falls
      // through to `generic`. G4's capture collects real form STRUCTURE from live pages, so the
      // mapping can be derived from what employers actually label their fields rather than authored
      // one ATS at a time.
      //
      // ⛔ THIS TABLE PRODUCES A TABLE, NOT A MODEL CALL AT FILL TIME. buildAnswers stays
      // deterministic — Jobo's integration terms say "No AI-generated answers" and §7 says the same.
      // Nothing here is consulted by a model; the resolver reads confirmed rows and nothing else.
      //
      // ⛔ NO ELIGIBILITY FIELD MAY EVER BE STORED HERE. Work authorisation, sponsorship, clearance,
      // visa, criminal history, EEO and years of experience resolve by EXACT HANDLER MAPPING or not
      // at all. Two live defects say why label matching must not get clever near an attestation:
      //   · `login_email` labelled "Email" resolved to the email handler and typed the candidate's
      //     address into a portal's SIGN-IN box at 0.9 confidence.
      //   · a work_authorization key substring-matched "do you now or in the future require
      //     sponsorship for work authorization" — a semantically INVERTED question, and a materially
      //     false attestation to an employer.
      // The exclusion is enforced in services/kb/formFieldMappings.js and asserted by a test, not
      // left as a comment.
      //
      // status DEFAULTS TO 'proposed' and only a human moves it. A wrong mapping fills the wrong
      // answer into a real employer's form, which cannot be recalled — so corroboration orders the
      // review queue and never promotes, exactly as with skill synonyms.
      id: "100_form_field_mappings",
      sql: `
        CREATE TABLE IF NOT EXISTS form_field_mappings (
          platform            TEXT    NOT NULL,
          label               TEXT    NOT NULL,
          field_key           TEXT    NOT NULL,
          confidence          REAL    NOT NULL DEFAULT 0,
          corroboration_count INTEGER NOT NULL DEFAULT 0,
          source_hosts_json   TEXT,
          status              TEXT    NOT NULL DEFAULT 'proposed',
          reviewed_at         INTEGER,
          reviewed_by         TEXT,
          first_seen          INTEGER,
          last_seen           INTEGER,
          PRIMARY KEY (platform, label)
        );
        CREATE INDEX IF NOT EXISTS idx_form_field_mappings_status
          ON form_field_mappings(platform, status);
      `,
    },
    {
      // U4 — BATCH PROVENANCE FOR ENRICHMENT, and the cheap version of it on purpose.
      //
      // The owner asked whether enrichment should move into its own table so it could be
      // manipulated and joined separately. It could, and the cost is the reason it does not:
      // mapJobRow is a field whitelist feeding the board, the mobile contract, the ATS scorer and
      // the KB rollups, and every one of those would need the join. This codebase's bug history is
      // contract mismatches; buying provenance with four new read paths would be paying in the
      // exact currency it keeps losing.
      //
      // So the enrichment columns STAY ON scraped_jobs and this migration adds only a pointer.
      // NO READ PATH CHANGES — mapJobRow is untouched and the board response is byte-identical.
      // What it buys: which run wrote a row, what that run cost, what it actually filled, and the
      // ability to identify and revert one bad batch.
      //
      // enrichment_batch_rows IS WHY A REVERT IS SAFE. Knowing "batch 7 touched these 25 rows" is
      // not enough to undo batch 7: enrichment writes through COALESCE, so it only ever filled
      // columns that were NULL — but on any given row it is unknowable afterwards WHICH columns
      // those were. Nulling every enrichment column would destroy values that came from ingestion
      // and predate the batch entirely. That is the same shape as the bug that nulled 120 rows
      // from the inside. So the before-image is recorded per row, and a revert restores it
      // exactly rather than reconstructing it.
      id: "101_enrichment_batches",
      sql: `
        CREATE TABLE IF NOT EXISTS enrichment_batches (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          source         TEXT    NOT NULL,
          provider       TEXT,
          model          TEXT,
          started_at     INTEGER NOT NULL,
          finished_at    INTEGER,
          rows_attempted INTEGER NOT NULL DEFAULT 0,
          rows_written   INTEGER NOT NULL DEFAULT 0,
          rows_failed    INTEGER NOT NULL DEFAULT 0,
          rows_empty     INTEGER NOT NULL DEFAULT 0,
          input_tokens   INTEGER NOT NULL DEFAULT 0,
          output_tokens  INTEGER NOT NULL DEFAULT 0,
          est_cost_usd   REAL    NOT NULL DEFAULT 0,
          coverage_json  TEXT,
          reverted_at    INTEGER,
          notes          TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_enrichment_batches_source
          ON enrichment_batches(source, started_at);
        CREATE TABLE IF NOT EXISTS enrichment_batch_rows (
          batch_id    INTEGER NOT NULL REFERENCES enrichment_batches(id) ON DELETE CASCADE,
          job_id      TEXT    NOT NULL,
          before_json TEXT    NOT NULL,
          filled_json TEXT,
          written_at  INTEGER NOT NULL,
          PRIMARY KEY (batch_id, job_id)
        );
        CREATE INDEX IF NOT EXISTS idx_enrichment_batch_rows_job
          ON enrichment_batch_rows(job_id);
        ALTER TABLE scraped_jobs ADD COLUMN enrichment_batch_id INTEGER;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_enrichment_batch
          ON scraped_jobs(enrichment_batch_id);
      `,
    },
    {
      // Task W. The lever seed in 056 has recorded `no_results` on every crawl since it landed —
      // five consecutive runs, watermark never advanced, zero lever rows ever on the board — and
      // the cause is neither a broken fetcher nor a missing company list. Lever's public postings
      // API is alive (api.lever.co/v0/postings/spotify?mode=json → 200, 75 postings); all THREE
      // seeded slugs return 404 {"ok":false,"error":"Document not found"} because those companies
      // have since moved off Lever. The plugin swallows per-company failures, so three dead slugs
      // are indistinguishable from one healthy empty board.
      //
      // Each company was re-probed across all three single-slug providers before being moved:
      //   Mercury → greenhouse/mercury   200, 59 postings (40 survive classification)
      //   Ramp    → ashby/ramp           200, 141 postings (96 survive classification)
      //   Retool  → 404 on greenhouse, lever AND ashby alike — no board found.
      //
      // Retool is deactivated rather than deleted or guessed, exactly as 070 did for Rippling:
      // active=0 is honoured by cacheJobs (`WHERE active = 1`), so it stops costing a failed
      // request every crawl while the row survives as a record to reactivate once someone finds
      // the real board. Guessing a slug is the failure this codebase has already learned from.
      //
      // Corrected forward rather than by editing 056, which has already run everywhere.
      id: "102_fix_dead_lever_slugs",
      sql: `
        UPDATE company_ats_list
           SET ats_type = 'greenhouse', ats_slug = 'mercury'
         WHERE company = 'Mercury' AND ats_type = 'lever' AND ats_slug = 'mercury';

        UPDATE company_ats_list
           SET ats_type = 'ashby', ats_slug = 'ramp'
         WHERE company = 'Ramp' AND ats_type = 'lever' AND ats_slug = 'ramp';

        UPDATE company_ats_list
           SET active = 0
         WHERE company = 'Retool' AND ats_type = 'lever' AND ats_slug = 'retool';
      `,
    },
    {
      // Task W. Company lists for the ATS providers that were registered in aggregator.js, wired
      // into cacheJobs and mapped in automationTier.js, but had never held a single company row —
      // so every crawl recorded `skipped_unconfigured` and the board carried greenhouse and ashby
      // only. The missing piece was the list, not the code.
      //
      // Every slug below was probed live and every number is measured, not estimated. `fetched`
      // is what the provider's API returns; `kept` is what survives classifyJob's blue-collar
      // eject and its roleKey===null drop inside cacheJobs — the only figure that becomes board
      // rows. All ACTIVE entries carry 100% description coverage, checked on the normalized rows.
      //
      // ACTIVE — adds ~141 rows to a ~1266-active board:
      //   lever/spotify       75 → 54     lever/matchgroup    74 → 54
      //   lever/wealthfront   23 → 17     lever/openx          7 →  4    lever/tala   7 → 2
      //   workable/blueground 20 →  2     workable/skroutz    12 →  2    workable/persado 3 → 2
      //   recruitee/channable 12 →  3     recruitee/hygraph    2 →  1
      //
      // INACTIVE — seeded as a record with its measured reason, the Rippling/Retool pattern.
      // Neither reason is "we did not check":
      //   lever/veeva            899 → 596 — real, complete rows, but +47% board size from one
      //                          company while enrichment drains at 25/day. Volume, not quality.
      //   smartrecruiters/Ubisoft2   282 →  97  ⎫ 0% description coverage. SmartRecruiters' and
      //   smartrecruiters/BoschGroup 900 → 334  ⎬ Workday's list endpoints carry no job text at
      //   workday/adobe              300 → 217  ⎭ all — unlike Workable, whose text turned out to
      //   need only `?details=true` on the same request, these two genuinely require a
      //   per-posting detail fetch, and an N+1 of that size has no budget model in cacheJobs'
      //   shared crawl loop. enrichJob.js skips description-less rows, so switching these on
      //   would add 648 permanently unenrichable rows to the board. See docs/w1-ats-providers.md.
      //
      // Workday's ats_slug is "wdNumber|tenant|site" (sources/workday.js parseSlug), not a bare
      // slug: a Workday board is per-tenant and needs three pieces of information, and the wd#
      // subdomain varies per tenant. Stored in the same column by encoding rather than by adding
      // Workday-only columns every other provider would leave null.
      id: "103_seed_remaining_ats_companies",
      sql: `
        INSERT OR IGNORE INTO company_ats_list (company, ats_type, ats_slug, active, bucket_role) VALUES
          ('Spotify',     'lever',          'spotify',                     1, 'software_engineer'),
          ('Match Group', 'lever',          'matchgroup',                  1, 'software_engineer'),
          ('Wealthfront', 'lever',          'wealthfront',                 1, 'software_engineer'),
          ('OpenX',       'lever',          'openx',                       1, 'software_engineer'),
          ('Tala',        'lever',          'tala',                        1, 'software_engineer'),
          ('Blueground',  'workable',       'blueground',                  1, 'software_engineer'),
          ('Skroutz',     'workable',       'skroutz',                     1, 'software_engineer'),
          ('Persado',     'workable',       'persado',                     1, 'software_engineer'),
          ('Channable',   'recruitee',      'channable',                   1, 'software_engineer'),
          ('Hygraph',     'recruitee',      'hygraph',                     1, 'software_engineer'),
          ('Veeva Systems','lever',         'veeva',                       0, 'software_engineer'),
          ('Ubisoft',     'smartrecruiters','Ubisoft2',                    0, 'software_engineer'),
          ('Bosch',       'smartrecruiters','BoschGroup',                  0, 'software_engineer'),
          ('Adobe',       'workday',        '5|adobe|external_experienced',0, 'software_engineer');
      `,
    },
    {
      // Task AA. `salary_period` is a three-value vocabulary — annual | hourly | monthly — shared
      // by the board filters, enrichJob's validation and the enrichment importer. 30 production
      // rows held the string `peryearsalary`, every one of them from lever.
      //
      // Ingestion put it there. sources/lever.js passes `salaryRange.interval` through verbatim,
      // Lever's own value is `per-year-salary`, and schema.js's normalizeSalaryPeriod stripped the
      // separators and then FELL THROUGH TO `return p` — so an unrecognised token became the
      // stored value instead of null. Fixed in the same commit as this migration; that stops new
      // rows acquiring it, and this repairs the ones that already have.
      //
      // FOUND BY THE EXPORT -> IMPORT ROUND TRIP, which is the part worth keeping: posting a
      // 500-row export straight back reported `wouldWrite 0` (correct — nothing changed) and
      // `rejected 30`. The importer validates against the same vocabulary and is all-or-nothing by
      // design, so these 30 rows made every export batch containing one of them un-importable. A
      // silent ingestion defect was disabling the transfer path, and nothing else had noticed.
      //
      // Mapped rather than nulled where Lever's meaning is unambiguous: per-year-salary IS annual.
      // The intervals with no honest target in the vocabulary (`per-week-salary`, `per-day-wage`,
      // `one-time-payment`) are set to NULL instead of being rounded to the nearest allowed value,
      // because inventing a period would misstate the pay. The final catch-all nulls anything
      // outside the vocabulary, so this repairs values no one has seen yet as well.
      id: "104_repair_salary_period_vocabulary",
      sql: `
        UPDATE scraped_jobs SET salary_period = 'annual'
         WHERE salary_period IN ('peryearsalary', 'per-year-salary', 'per_year_salary');
        UPDATE scraped_jobs SET salary_period = 'hourly'
         WHERE salary_period IN ('perhourwage', 'per-hour-wage', 'per_hour_wage');
        UPDATE scraped_jobs SET salary_period = 'monthly'
         WHERE salary_period IN ('permonthsalary', 'per-month-salary', 'per_month_salary');
        UPDATE scraped_jobs SET salary_period = NULL
         WHERE salary_period IS NOT NULL
           AND salary_period NOT IN ('annual', 'hourly', 'monthly');
      `,
    },
    {
      // 105 — ANONYMOUS SPEND WAS BOUNDED BY A COOKIE THE CALLER CONTROLS.
      // standaloneRateLimit counted an anonymous caller's runs by req.sessionID, so the quota
      // reset with a new cookie: clearing site data, or a fresh incognito window, restored a full
      // allowance. /api/standalone/generate runs Sonnet at 8192 max_tokens and is the single
      // largest per-call cost in the system, so the bound that mattered most was the one anybody
      // with a browser could step around. client_ip is the coarse identity that does not reset on
      // demand. Nullable and additive: existing rows keep counting under their session id.
      id: "105_standalone_usage_client_ip",
      sql: `
        ALTER TABLE standalone_usage ADD COLUMN client_ip TEXT;
        CREATE INDEX IF NOT EXISTS idx_standalone_usage_ip
          ON standalone_usage(client_ip, service, used_at);
        CREATE INDEX IF NOT EXISTS idx_standalone_usage_service_time
          ON standalone_usage(service, used_at);
      `,
    },
    {
      // 106 — CREDENTIAL-SHAPED RESIDUE OF A DELETED FEATURE.
      // The extension token copy/paste flow was removed in c818b9c. SQLite does not drop a table
      // when its CREATE statement leaves the source, so production kept `import_extension_tokens`
      // — 3 rows of token hashes bound to users(id) that no code can expire, consume or rotate,
      // because the code that did was deleted. Zero references repo-wide, verified before writing
      // this: the only mentions are docs and the schema-diff harness that reports the table.
      // Filed by task T, restated by AH-2, never done.
      //
      // IF EXISTS because the table is PRODUCTION-ONLY — a local checkout that never ran the
      // removed feature has nothing to drop, and this must be a no-op there rather than a failure.
      id: "106_drop_import_extension_tokens",
      sql: `
        DROP TABLE IF EXISTS import_extension_tokens;
      `,
    },
    {
      // 107 — DETAIL-FETCH BOOKKEEPING (task Y phase 2, sections 2A and 2D).
      //
      // The description for a SmartRecruiters or Workday posting now arrives from a SECOND HTTP
      // request, made inside the enrichment pass rather than the crawl (services/jobs/detailFetch.js
      // explains why that seam). Three columns, each answering a question the pass cannot answer
      // without persisting it:
      //
      //   detail_fetched_at      when a fetch last SUCCEEDED for this row. Distinguishes "has a
      //                          description because the list carried one" from "has one because
      //                          we bought it" — which is the difference between a source that
      //                          needs the N+1 and one that does not, per row rather than per
      //                          assumption.
      //
      //   detail_fetch_attempts  how many requests this row has cost. 2D asks for
      //                          descriptions-obtained-per-request-SPENT per company, and spend is
      //                          not derivable from outcomes: a row with no description might have
      //                          cost zero requests or five, and those are opposite findings.
      //                          Also the bound on re-spending — a posting deleted upstream 404s
      //                          forever, and "one crawl to learn that, not one crawl per crawl"
      //                          is the whole point.
      //
      //   detail_fetch_error     the last reason, as a tag ('http_404', 'no_text', 'http_429', …).
      //                          A count without a reason cannot tell "the posting is gone" from
      //                          "we were rate-limited", and those want opposite responses.
      //
      // ⛔ NOTHING HERE MARKS A ROW DONE, AND THAT IS DELIBERATE. `content_hash` and `enriched_at`
      // remain the only "this row has been processed" signals, and the detail fetch never writes
      // either — on success OR failure. Stamping a row as complete when nothing was filled is what
      // once cost this project 120 rows, and a 429 mid-fetch is the obvious way to recreate it. A
      // row that has burned its attempts is still a candidate forever; it has simply stopped being
      // worth another request until somebody clears the counter, which is one UPDATE and is
      // surfaced in the admin health view rather than buried.
      //
      // ADDITIVE AND NULLABLE. Every existing row reads NULL/0, which is the correct history:
      // no row in the board today was obtained through a detail fetch, because the path did not
      // exist. No backfill, because there is nothing true to backfill with.
      id: "107_detail_fetch_bookkeeping",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN detail_fetched_at     INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN detail_fetch_attempts INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE scraped_jobs ADD COLUMN detail_fetch_error    TEXT;

        -- The fetch pass's own selector: active, description-less, attempts under the cap. Without
        -- this it is a full scan of scraped_jobs on every enrichment run, and the whole design
        -- premise is that this pass is cheap enough to run unconditionally.
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_detail_pending
          ON scraped_jobs(is_active, source, detail_fetch_attempts)
          WHERE description IS NULL OR TRIM(description) = '';
      `,
    },
    {
      // 108 — THE ATS REPORT CACHE IS PER (USER, PROFILE, JOB), NOT PER (USER, JOB).
      //
      // ⛔ THE SERIOUS DEFECT CC5 FIXED IS NOT THIS ONE — it was `scraped_jobs.ats_report`, one cell
      // per JOB, served to any user who opened the posting (a candidate's matched/missing terms,
      // computed against their résumé, handed to a stranger). That is removed in server.js and needs
      // no migration. This is the narrower sibling: `ats_only_reports` was correctly scoped to a
      // user and incorrectly scoped across their PROFILES, so a user with an engineering profile and
      // a data profile got one cached report per posting and the second profile read the first's.
      //
      // SQLite cannot widen a UNIQUE constraint in place, so the table is rebuilt and refilled.
      // Existing rows carry `domain_profile_id NULL`, which honestly means "cached before profiles
      // were distinguished" — the reads treat it as a last-resort fallback rather than deleting
      // history. There are 0 rows on this database, so the rebuild is a no-op here and the code path
      // still has to be right for a deployment that has some.
      //
      // ⛔ scorer_version AND scored_at ARE NOT DECORATION. A stored score with neither is
      // unfalsifiable: the one row that ever carried a score stored 43 and scored null on the same
      // day, and nothing recorded which engine produced the 43 — so a stale cache and a changed
      // scorer were indistinguishable. Any surviving stored score now says what computed it, which
      // is what lets a later version invalidate it instead of guessing.
      id: "108_ats_reports_per_profile",
      sql: `
        -- The per-user ATS report cache was UNIQUE(user_id, job_id): one row per user per job, with
        -- no profile. A user with an engineering profile and a data profile got ONE cached report
        -- for a posting, whichever they opened first, and the other profile silently read it.
        --
        -- SQLite cannot drop or widen a UNIQUE constraint in place, so the table is rebuilt. It is
        -- additive in the sense that matters: every existing row is carried over with
        -- domain_profile_id NULL, which reads as "cached before profiles were distinguished" and is
        -- honoured by the reads as a last-resort fallback rather than being thrown away.
        --
        -- scorer_version and scored_at exist because a stored score with neither is UNFALSIFIABLE.
        -- The one row that used to carry a score stored 43 while scoring null on the same day, and
        -- nothing recorded which engine produced the 43, so there was no way to tell a stale cache
        -- from a changed scorer. Any stored score now says what computed it and when.
        CREATE TABLE IF NOT EXISTS ats_only_reports_v2 (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          domain_profile_id INTEGER REFERENCES domain_profiles(id) ON DELETE CASCADE,
          job_id            TEXT NOT NULL,
          ats_report        TEXT NOT NULL,
          ats_score         INTEGER,
          scorer_version    TEXT,
          scored_at         INTEGER,
          created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(user_id, domain_profile_id, job_id)
        );

        INSERT INTO ats_only_reports_v2
          (user_id, domain_profile_id, job_id, ats_report, ats_score, scorer_version, scored_at, created_at)
        SELECT user_id, NULL, job_id, ats_report, ats_score, NULL, created_at, created_at
        FROM ats_only_reports;

        DROP TABLE ats_only_reports;
        ALTER TABLE ats_only_reports_v2 RENAME TO ats_only_reports;

        -- The board LEFT JOINs this per (user, profile, job) on every page, so the lookup has to be
        -- an index seek rather than a scan of one user's whole history.
        CREATE INDEX IF NOT EXISTS idx_ats_only_reports_lookup
          ON ats_only_reports(user_id, domain_profile_id, job_id);
      `,
    },
    {
      // 109 — RESTORE THE SENIORITY ENRICHMENT STRIPPED OUT OF normalized_title.
      //
      // ccfef0f stopped enrichment overwriting this column. This repairs what it already did — but
      // only the part of it that measurement can defend, which is NARROWER than the audit that
      // prompted it first claimed.
      //
      // ⛔ THE OBVIOUS REPAIR IS WRONG AND WAS MEASURED BEFORE BEING REJECTED. 475 production rows
      // had normalized_title rewritten and 469 were made SHORTER, which docs/PART1_RECONCILED
      // -2026-09-18.md §4 read as systematic truncation. Looking at the largest losses says
      // otherwise — several are the column doing its job:
      //
      //     "senior fullstack engineer (f/m/d) - berlin i germany | eu i remote"
      //          -> "senior fullstack engineer"                        BETTER
      //     "fraud analyst (revenue protection) - 12-month fixed-term"
      //          -> "fraud analyst"                                    BETTER
      //
      // Restoring all 469 would push location, EEO and contract-duration noise back into a column
      // whose entire purpose is to strip it. Length was a bad proxy for harm.
      //
      // WHAT IS DEFENSIBLE IS SENIORITY LOSS. Of the sampled rows that carried a seniority token,
      // 27 LOST it against 10 that kept it, and those are unambiguous:
      //
      //     "senior / staff product engineer"                -> "product engineer"
      //     "lead product marketing manager - verticals"      -> "product marketing manager"
      //     "senior manager, account executive | mid-market"  -> "account executive manager"
      //
      // `detectSeniority` in services/jobs/classifyJob.js matches exactly these tokens on the title
      // to decide a posting's level, and the ATS scorer prices seniority mismatch. There is no
      // reading in which dropping "senior" makes a normalised title better. 54 rows on production.
      //
      // ⛔ THE EARLIEST BEFORE-IMAGE, NOT THE LATEST. 28 jobs appear in more than one enrichment
      // batch, so the most recent before_json for those holds a value a PREVIOUS pass had already
      // truncated. Restoring that would restore the damage. ROW_NUMBER() ordered by written_at
      // picks the original ingested value. Verified against a fixture carrying exactly that shape.
      //
      // Naturally idempotent: after the restore the WHERE cannot match again, because the token it
      // looks for is present. Re-running changes 0 rows.
      //
      // NOT PRESERVED, and stated rather than discovered: the truncated values are overwritten and
      // not recorded anywhere. They are the damage; the authoritative value stays in
      // enrichment_batch_rows.before_json, so the direction that matters remains recoverable.
      id: "109_restore_stripped_seniority_titles",
      sql: `
        WITH earliest AS (
          SELECT e.job_id,
                 json_extract(e.before_json, '$.normalized_title') AS orig,
                 ROW_NUMBER() OVER (PARTITION BY e.job_id ORDER BY e.written_at, e.batch_id) AS rn
          FROM enrichment_batch_rows e
          WHERE json_extract(e.before_json, '$.normalized_title') IS NOT NULL
            AND TRIM(json_extract(e.before_json, '$.normalized_title')) <> ''
        )
        UPDATE scraped_jobs AS s
        SET normalized_title = (SELECT x.orig FROM earliest x WHERE x.job_id = s.job_id AND x.rn = 1)
        WHERE EXISTS (
          SELECT 1 FROM earliest x
          WHERE x.job_id = s.job_id AND x.rn = 1
            AND s.normalized_title <> x.orig
            AND (   (x.orig LIKE '%staff%'         AND s.normalized_title NOT LIKE '%staff%')
                 OR (x.orig LIKE '%senior%'        AND s.normalized_title NOT LIKE '%senior%')
                 OR (x.orig LIKE '%principal%'     AND s.normalized_title NOT LIKE '%principal%')
                 OR (x.orig LIKE '%lead%'          AND s.normalized_title NOT LIKE '%lead%')
                 OR (x.orig LIKE '%distinguished%' AND s.normalized_title NOT LIKE '%distinguished%')
                 OR (x.orig LIKE '%director%'      AND s.normalized_title NOT LIKE '%director%')
                 OR (x.orig LIKE '%head of%'       AND s.normalized_title NOT LIKE '%head of%'))
        );
      `,
    },
    {
      // 110 — EVERY STORED ATS REPORT SAYS WHICH CANDIDATE BASIS PRODUCED IT.
      //
      // The board now ranks by fit, read from ats_only_reports, and a precompute fills that table
      // for every active posting ahead of time (services/jobs/boardFitPrecompute.js). A precomputed
      // score is only reusable while the résumé, claims and profile it was computed from are
      // unchanged — so each row records a hash of those inputs, and a row whose hash no longer
      // matches is re-scored instead of served.
      //
      // ⛔ REUSED ats_only_reports RATHER THAN A NEW board_fit_scores TABLE, deliberately. The card's
      // badge (matchScore), the ATS panel's cached report and the apply stamp already read this row.
      // A second table holding the same score would be two stores of one fact, free to disagree —
      // a card sorted as Strong while its badge and its report say Weak. Cost, measured: ~850 bytes
      // of report per row, ~2.2 MB per profile over a 2,616-posting board.
      //
      // Additive: one nullable column. Existing rows read NULL, which the precompute treats as
      // "basis unknown" (stale), never as fresh. The existing 108 index on
      // (user_id, domain_profile_id, job_id) already serves the board's join and the plan's scan.
      id: "110_ats_reports_basis_hash",
      sql: `
        -- The hash of the candidate-side inputs a stored report was scored against: the runtime
        -- basis (résumé text, signal profile, domain profile, claims) plus the scorer version.
        -- NULL on rows written before this migration, which reads as "basis unknown" — stale,
        -- never fresh — so nothing written without a hash can be mistaken for a current score.
        ALTER TABLE ats_only_reports ADD COLUMN basis_hash TEXT;
      `,
    },
    {
      // UI step 3a (09-30) — the daily draft. docs/UI_REDESIGN.md §3.1, services/dailyDraft.js.
      // Stores the DEAL — which cards, in what order, what they looked like at deal time — and NOT
      // the decisions, which already live in apply_run_jobs and user_jobs. The PRIMARY KEY makes a
      // concurrent first deal lose cleanly; UNIQUE(job) keeps a job to one slot per day.
      id: "111_daily_drafts",
      sql: `
        CREATE TABLE IF NOT EXISTS daily_drafts (
          user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          profile_id  INTEGER NOT NULL,
          draft_date  TEXT    NOT NULL,
          position    INTEGER NOT NULL,
          job_id      TEXT    NOT NULL,
          band        TEXT    NOT NULL,
          card_json   TEXT    NOT NULL,
          dealt_at    INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, profile_id, draft_date, position),
          UNIQUE (user_id, profile_id, draft_date, job_id)
        );
      `,
    },
    {
      // Follow-up 18 (09-30): the light/dark preference stored with the ACCOUNT, so it follows the
      // user between devices (UI_REDESIGN §Step 6 said per user; it was per device). NULL = never set,
      // which means "system" and lets a device keep its own until the user chooses.
      id: "112_users_theme_preference",
      sql: `
        ALTER TABLE users ADD COLUMN theme_preference TEXT;
      `,
    },
    {
      // Account management (09-30): a registry of each user's sessions (the store is sealed and keyed
      // by sid alone, so it cannot list "my sessions"); whether the password was ever SET by the user
      // (OAuth accounts got a random one — backfilled: no provider id means a password account);
      // the uploaded picture; a verified-email stamp; one-time email codes; and the merge log.
      id: "113_account_management",
      sql: `
        CREATE TABLE IF NOT EXISTS user_sessions (
          sid TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL,
          last_seen_at INTEGER NOT NULL,
          user_agent TEXT,
          ip_hint TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
        ALTER TABLE users ADD COLUMN password_set INTEGER NOT NULL DEFAULT 0;
        UPDATE users SET password_set = CASE WHEN google_auth_id IS NULL AND linkedin_auth_id IS NULL AND github_auth_id IS NULL THEN 1 ELSE 0 END;
        ALTER TABLE users ADD COLUMN avatar_path TEXT;
        ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
        CREATE TABLE IF NOT EXISTS email_codes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          purpose TEXT NOT NULL,
          email TEXT,
          code_hash TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          used_at INTEGER,
          attempts INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_email_codes_user ON email_codes(user_id, purpose);
        -- no foreign keys: the FROM account is gone by design, and the log outlives both
        CREATE TABLE IF NOT EXISTS account_merges (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          into_user_id INTEGER NOT NULL,
          from_user_id INTEGER NOT NULL,
          summary_json TEXT,
          merged_at INTEGER NOT NULL
        );
      `,
    },
    {
      // Queue 38 (10-01): the deck's geometry — a preset or the three sliders — with the ACCOUNT, as
      // theme_preference is (112). JSON in shared/deckGeometry.js's shape; NULL = never set = standard.
      id: "114_users_deck_geometry",
      sql: `
        ALTER TABLE users ADD COLUMN deck_geometry TEXT;
      `,
    },
    {
      // Owner, 10-02 (A44): Skroutz's Workable board is alive but every posting is in Greece, and draft
      // is US-only (A37). Deactivated, not deleted — as 102 did for Retool: active=0 is honoured by
      // cacheJobs, the crawl stops spending a request on it, and the row stays as the record should
      // it ever post in the US. Its existing rows are held out by the A37 gate on the next crawl.
      // (Hygraph's empty board is KEPT, also the owner's call.)
      id: "115_deactivate_skroutz_outside_us",
      sql: `
        UPDATE company_ats_list
           SET active = 0
         WHERE company = 'Skroutz' AND ats_type = 'workable' AND ats_slug = 'skroutz';
      `,
    },
    {
      // A49 (10-02): a duplicate is RETIRED, recorded and restorable — never just demoted, never
      // hard-deleted. duplicate_of names the canonical row; retired_reason/retired_at say why and
      // when. job_dedup_log keeps what moved with each retirement (users' Saves, Passes,
      // applications, resumes) so services/jobs/dedupRetire.js can put it back; restored_at marks a
      // pair someone kept apart, which dedup then never merges again. Additive only.
      id: "116_dedup_retire_and_log",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN duplicate_of   TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN retired_reason TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN retired_at     INTEGER;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_duplicate_of ON scraped_jobs(duplicate_of);
        CREATE TABLE IF NOT EXISTS job_dedup_log (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          from_job_id TEXT NOT NULL,
          to_job_id   TEXT NOT NULL,
          reason      TEXT NOT NULL,
          moved_json  TEXT,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          restored_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_job_dedup_log_from ON job_dedup_log(from_job_id);
        CREATE INDEX IF NOT EXISTS idx_job_dedup_log_to   ON job_dedup_log(to_job_id);
      `,
    },
    {
      // 118 (A52) — EVERY STORED ATS REPORT SAYS WHICH VERSION OF THE POSTING IT SCORED.
      // 110's basis_hash covers the candidate side only, so a posting scored before its enrichment
      // landed kept that verdict forever: a board card read "No signal" while the ATS panel, scoring
      // the same posting fresh, read "Strong match". job_hash is services/jobs/boardFitPrecompute.js
      // atsJobInputHash over the columns the scorer reads; a row is fresh only when both hashes
      // match. Additive: NULL on existing rows reads as stale, never fresh, so the first pass after
      // deploy re-scores each active profile's board once.
      id: "118_ats_reports_job_hash",
      sql: `
        ALTER TABLE ats_only_reports ADD COLUMN job_hash TEXT;
      `,
    },
    {
      // A58 (10-02): what an admin write CHANGED, with the value it replaced, so it can be undone and
      // so it can be read afterwards. Job Review's Save/Unclassify rewrote a posting's role map with no
      // record of the old one; an admin user delete left no trace that it happened. One row per write.
      // admin_user_id deliberately has NO foreign key and is not named user_id: deleting an admin must
      // not cascade away the record of what that admin did, and this is not a per-user table.
      id: "119_admin_audit_log",
      sql: `
        CREATE TABLE IF NOT EXISTS admin_audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          at INTEGER NOT NULL DEFAULT (unixepoch()),
          admin_user_id INTEGER,
          action TEXT NOT NULL,
          target TEXT,
          before_json TEXT,
          after_json TEXT,
          undone_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
          ON admin_audit_log(action, target);
      `,
    },
    {
      // A59 (10-02): A DRAFT WAITS IN LINE (owner, O44). A Draft made while one of the user's runs is
      // active used to be refused 429 run_already_active; it now waits as an apply_runs row with
      // status 'waiting', and line_position is its place (lowest starts next). NULL on every other
      // status, so existing rows need nothing. The waiting run's jobs keep status 'queued', which is
      // what keeps the duplicate filter, the caps and the outcome partition unchanged.
      id: "120_apply_run_line",
      sql: `
        ALTER TABLE apply_runs ADD COLUMN line_position INTEGER;
        CREATE INDEX IF NOT EXISTS idx_apply_runs_line
          ON apply_runs(user_id, status, line_position);
      `,
    },
    {
      // A63 (owner, O45c, 10-02): PENDING -> VERIFIED -> SUBMITTED, and a résumé generation costs one
      // of the day's Draft slots. application_records holds a job the user generated for, opened the
      // posting of, or exported a résumé for — PENDING until they record the submission (when, how,
      // a confirmation) and it is VERIFIED; only then is job_applications written. Nothing becomes
      // "submitted" on a click alone. draft_slot_uses is the ledger of board generations; Drafts are
      // counted from apply_run_jobs, so a generation and a Draft share one daily allowance.
      // The backfill makes every résumé generated before this a PENDING record, unless it was already
      // applied to or belongs to a Draft (the pipeline tracks those).
      id: "121_application_records",
      sql: `
        CREATE TABLE IF NOT EXISTS application_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'pending',
          origin TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          submitted_at INTEGER,
          method TEXT,
          reference TEXT,
          evidence_text TEXT,
          evidence_url TEXT,
          recorded_at INTEGER,
          verified_at INTEGER,
          verification_json TEXT,
          withdrawn_at INTEGER,
          UNIQUE(user_id, job_id)
        );
        CREATE INDEX IF NOT EXISTS idx_application_records_user_state
          ON application_records(user_id, state, updated_at);
        CREATE TABLE IF NOT EXISTS draft_slot_uses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind TEXT NOT NULL,
          job_id TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_draft_slot_uses_user_time
          ON draft_slot_uses(user_id, created_at);
        INSERT OR IGNORE INTO application_records (user_id, job_id, state, origin, created_at, updated_at)
          SELECT r.user_id, r.job_id, 'pending', 'generated', COALESCE(r.created_at, unixepoch()), unixepoch()
          FROM resumes r
          WHERE r.job_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM job_applications ja WHERE ja.user_id = r.user_id AND ja.job_id = r.job_id)
            AND NOT EXISTS (SELECT 1 FROM apply_run_jobs rj WHERE rj.user_id = r.user_id AND rj.job_id = r.job_id);
      `,
    },
    {
      // A62 (owner, 10-02): ONE GATEWAY FOR JOB DATA IN. job_captures records every job a user brought
      // in (extension capture, imported URL, pasted text) or an admin imported, with the ATS host and
      // slug read from its URL — what A45's slug harvesting reads — and what the gateway did with it
      // (inserted, or attached to an existing row; held out of market). user_id is SET NULL on account
      // deletion: the URL and slug are a fact about an employer's board, not about the person.
      // job_import_batches makes an admin import revertible: the rows a batch INSERTED are retired
      // (soft, A49's columns), never deleted.
      id: "122_job_captures",
      sql: `
        CREATE TABLE IF NOT EXISTS job_captures (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          job_id TEXT NOT NULL,
          url TEXT,
          ats_type TEXT,
          ats_slug TEXT,
          origin TEXT NOT NULL,
          action TEXT NOT NULL,
          out_of_market INTEGER NOT NULL DEFAULT 0,
          batch_id INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_job_captures_slug ON job_captures(ats_type, ats_slug);
        CREATE INDEX IF NOT EXISTS idx_job_captures_batch ON job_captures(batch_id);
        CREATE TABLE IF NOT EXISTS job_import_batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          admin_user_id INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          rows_in INTEGER NOT NULL DEFAULT 0,
          inserted INTEGER NOT NULL DEFAULT 0,
          attached INTEGER NOT NULL DEFAULT 0,
          held_out_of_market INTEGER NOT NULL DEFAULT 0,
          refused INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          reverted_at INTEGER,
          reverted_rows INTEGER
        );
      `,
    },
    {
      // A72 (owner, 10-03): "normalise synonyms with equal weight: ai = artificial intelligence, ml =
      // machine learning". The owner's brief IS the review that services/kb/skillSynonyms.js requires
      // before a pair may be confirmed, so the two land confirmed, as aliases, reviewed_by the brief.
      // Stored as canonicalPair orders them (term < equivalent). An earlier proposal or rejection of
      // the same pair is overruled: the owner's word is the newest review. The board's search
      // (services/jobs/boardSearch.js) and the scorer (CC3) both read loadConfirmedSynonyms, so these
      // two rows reach both; there is no second synonym table.
      id: "123_owner_skill_aliases",
      sql: `
        INSERT INTO skill_synonyms
          (term, equivalent, relation, confidence, corroboration_count, status, reviewed_at, reviewed_by,
           first_seen, last_seen, updated_at)
        VALUES
          ('ai', 'artificial intelligence', 'alias', 1, 0, 'confirmed', unixepoch(), 'owner (A72 brief, 10-03)',
           unixepoch(), unixepoch(), unixepoch()),
          ('machine learning', 'ml', 'alias', 1, 0, 'confirmed', unixepoch(), 'owner (A72 brief, 10-03)',
           unixepoch(), unixepoch(), unixepoch())
        ON CONFLICT(term, equivalent) DO UPDATE SET
          relation = 'alias', status = 'confirmed', reviewed_at = excluded.reviewed_at,
          reviewed_by = excluded.reviewed_by, updated_at = excluded.updated_at;
      `,
    },
    {
      // A77 (owner, 10-03): company logos resolved ONCE PER COMPANY during enrichment and STORED — the
      // bytes, served first-party from /api/company-logo/<key> (services/jobs/companyLogoStore.js), so
      // a provider that dies later cannot take stored logos with it. status 'none' records a company
      // nothing could serve (re-tried after 30 days); no URL is ever stored for it.
      id: "124_company_logos",
      sql: `
        CREATE TABLE IF NOT EXISTS company_logos (
          company_key TEXT PRIMARY KEY,
          company TEXT NOT NULL,
          domain TEXT,
          status TEXT NOT NULL,
          provider TEXT,
          mime TEXT,
          bytes BLOB,
          error TEXT,
          checked_at INTEGER NOT NULL
        );
      `,
    },
    {
      // D16 (owner, 10-03): the résumé an application SENT, kept with the application and downloadable
      // from The Table months later. resumes.html is the working copy and a regeneration overwrites
      // it, so it cannot answer "what did I send?". Stored as the HTML, brotli-compressed
      // (services/applicationArtifacts.js: ~1.7 KB a résumé, measured; a stored PDF is ~56x that), with
      // the sha256 of the uncompressed bytes so a corrupt row FAILS on read instead of serving an empty
      // file. A PDF is printed from it on demand and never stored. No user_id: the artifact belongs to
      // its record and goes with it (and with the account, through the record's cascade).
      id: "125_application_artifacts",
      sql: `
        CREATE TABLE IF NOT EXISTS application_artifacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          record_id INTEGER NOT NULL REFERENCES application_records(id) ON DELETE CASCADE,
          kind TEXT NOT NULL DEFAULT 'resume',
          media_type TEXT NOT NULL,
          encoding TEXT NOT NULL,
          sha256 TEXT NOT NULL,
          raw_bytes INTEGER NOT NULL,
          stored_bytes INTEGER NOT NULL,
          body BLOB NOT NULL,
          source TEXT NOT NULL,
          resume_id INTEGER,
          resume_updated_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(record_id, kind)
        );
      `,
    },
    {
      // A76 under D17 (owner, 10-03: "only résumé generation may call a model"): the validation
      // corpus is graded OUTSIDE the product — export a blind file, grade it, import the grades. The
      // grades REUSE the enrichment manual path's provenance, not a second batch system: an import
      // is an enrichment_batches row (kind 'ats_grade'), each graded posting an enrichment_batch_rows
      // before-image, and revertBatch dispatches on kind. `kind` defaults to 'enrichment', so every
      // existing batch reads exactly as before. A grade is a judgement of a posting AGAINST A PROFILE,
      // so it cannot live on scraped_jobs like an enrichment column; it gets its own table, keyed by
      // grader so the owner's, an external model's and the 10-03 model grades sit side by side.
      // content_hash is the staleness interlock: a grade is about the text that was graded.
      id: "126_ats_grade_corpus",
      sql: `
        ALTER TABLE enrichment_batches ADD COLUMN kind TEXT NOT NULL DEFAULT 'enrichment';
        CREATE TABLE IF NOT EXISTS ats_corpus_grades (
          corpus       TEXT    NOT NULL,
          job_id       TEXT    NOT NULL,
          grader       TEXT    NOT NULL,
          profile_id   INTEGER,
          fit          INTEGER NOT NULL CHECK (fit BETWEEN 1 AND 5),
          content_hash TEXT    NOT NULL,
          batch_id     INTEGER REFERENCES enrichment_batches(id),
          graded_at    INTEGER NOT NULL,
          note         TEXT,
          PRIMARY KEY (corpus, job_id, grader)
        );
      `,
    },
    {
      // D20 (owner, 10-04): the slug harvest rides in the daily manual sweep. A sweep runs a handful
      // of SerpApi google_jobs searches by hand (no cron, no model), pools every ATS URL in the
      // results' apply_options as an UNORDERED set of (ats_type, slug) — never attached to the job it
      // was found under, because Google clusters different employers' postings into one result — and
      // the owner reviews an export and imports decisions. Numbered 127: 125 and 126 are taken by the
      // unmerged D16 and A76 branches.
      //   slug_harvest_sweeps        one row per sweep: what was searched, what it found, per query
      //   slug_harvest_pool          one row per (ats_type, slug) ever seen, its last validation and
      //                              the owner's decision
      //   slug_harvest_imports       provenance for an imported decision file (revertable whole)
      //   slug_harvest_import_rows   each row's before-image, so a revert restores it exactly
      id: "127_slug_harvest",
      sql: `
        CREATE TABLE IF NOT EXISTS slug_harvest_sweeps (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          started_at    INTEGER NOT NULL,
          finished_at   INTEGER,
          admin_user_id INTEGER,
          searches      INTEGER NOT NULL DEFAULT 0,
          links         INTEGER NOT NULL DEFAULT 0,
          ats_links     INTEGER NOT NULL DEFAULT 0,
          pairs         INTEGER NOT NULL DEFAULT 0,
          new_pairs     INTEGER NOT NULL DEFAULT 0,
          queries_json  TEXT NOT NULL,
          error         TEXT
        );
        CREATE TABLE IF NOT EXISTS slug_harvest_pool (
          ats_type        TEXT NOT NULL,
          slug_key        TEXT NOT NULL,
          ats_slug        TEXT NOT NULL,
          sample_url      TEXT,
          first_sweep_id  INTEGER,
          first_query     TEXT,
          first_seen_at   INTEGER NOT NULL,
          last_seen_at    INTEGER NOT NULL,
          times_seen      INTEGER NOT NULL DEFAULT 1,
          state           TEXT,
          validation_json TEXT,
          validated_at    INTEGER,
          decision        TEXT,
          company         TEXT,
          decided_at      INTEGER,
          import_id       INTEGER,
          company_id      INTEGER,
          PRIMARY KEY (ats_type, slug_key)
        );
        CREATE TABLE IF NOT EXISTS slug_harvest_imports (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          imported_at     INTEGER NOT NULL,
          admin_user_id   INTEGER,
          file_sha256     TEXT NOT NULL,
          rows_written    INTEGER NOT NULL DEFAULT 0,
          companies_added INTEGER NOT NULL DEFAULT 0,
          reverted_at     INTEGER
        );
        CREATE TABLE IF NOT EXISTS slug_harvest_import_rows (
          import_id   INTEGER NOT NULL REFERENCES slug_harvest_imports(id),
          ats_type    TEXT NOT NULL,
          slug_key    TEXT NOT NULL,
          before_json TEXT NOT NULL,
          after_json  TEXT NOT NULL,
          company_id  INTEGER,
          PRIMARY KEY (import_id, ats_type, slug_key)
        );
      `,
    },
    {
      // D29 (owner, 10-04): FILTERS QUERY OUR OWN TAGS, NOT FREE TEXT. services/jobs/jobTags.js
      // derives them deterministically (no model call, D17) and the owner fills the rest through
      // export -> tag -> import (routes/jobTags.js). Every tag is nullable and NULL means UNKNOWN —
      // every predicate over them is soft-null. Numbered 128: 125 (D16) and 126 (A76) are held by
      // unmerged branches and 127 is the slug harvest.
      //   scraped_jobs.tag_*     the scalar tags; tag_owner_json holds owner-set values, which a
      //                          re-tag never overwrites; tag_basis/tag_version say when to re-tag
      //   job_tag_places         a posting's places as a SET (country, state, metro) — one posting
      //                          can be in several places, so location is not a column
      id: "128_job_tags",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN tag_level TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN tag_function TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN tag_employment TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN tag_workplace TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN tag_remote INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN tag_us TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN tag_basis TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN tag_version INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN tag_owner_json TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN tagged_at INTEGER;
        CREATE TABLE IF NOT EXISTS job_tag_places (
          job_id  TEXT NOT NULL,
          country TEXT NOT NULL,
          state   TEXT,
          metro   TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_job_tag_places_job   ON job_tag_places(job_id);
        CREATE INDEX IF NOT EXISTS idx_job_tag_places_metro ON job_tag_places(metro, job_id);
        CREATE INDEX IF NOT EXISTS idx_job_tag_places_state ON job_tag_places(state, job_id);
      `,
    },
    {
      // D43 (10-06): AN APPLICATION RECORD MUST SURVIVE ITS POSTING. job_applications already held the
      // company, title, URL and location; the pay was read from the posting through a LEFT JOIN, so a
      // deleted posting blanked it. apply_run_jobs held only the job_id. Both now snapshot what the user
      // applied to at the moment they applied, so the record stands without the posting.
      id: "129_application_snapshots",
      sql: `
        ALTER TABLE job_applications ADD COLUMN salary_min INTEGER;
        ALTER TABLE job_applications ADD COLUMN salary_max INTEGER;
        ALTER TABLE job_applications ADD COLUMN salary_currency TEXT;
        ALTER TABLE apply_run_jobs ADD COLUMN posting_title TEXT;
        ALTER TABLE apply_run_jobs ADD COLUMN posting_company TEXT;
        ALTER TABLE apply_run_jobs ADD COLUMN posting_url TEXT;
        ALTER TABLE apply_run_jobs ADD COLUMN posting_location TEXT;
      `,
    },
    {
      // D53 (10-07): CLEAR GOES TO A 7-DAY BIN. Draft House's Remove was already a SOFT hide (hidden_at);
      // it now also sets purge_after, so a cleared item can be restored for 7 days and is then purged by
      // services/draftBin.js's sweep — which sets purged_at once it has scrubbed the row's answers, packets
      // and screenshot. A row hidden before this migration has purge_after NULL: it is not in the bin and
      // is never purged (still restorable by an operator, as before).
      id: "130_draft_bin",
      sql: `
        ALTER TABLE apply_run_jobs ADD COLUMN purge_after INTEGER;
        ALTER TABLE apply_run_jobs ADD COLUMN purged_at INTEGER;
        CREATE INDEX IF NOT EXISTS idx_apply_run_jobs_bin ON apply_run_jobs(user_id, purge_after);
      `,
    },
    {
      // D58 (10-07): BASE → TAILORED, STORED AS ONE PAIR. A generation already measures the base résumé's
      // score for the posting just before the model call (AK1's atsScoreBefore, the same scorer and job as
      // the tailored score). It is now kept beside the tailored score on the résumé, so "Base 58 → tailored
      // 71" is one stored statement every surface reads. NULL: generated before this, or the scorer declined.
      id: "131_resume_score_pair",
      sql: `
        ALTER TABLE resumes ADD COLUMN base_ats_score INTEGER;
        ALTER TABLE resume_versions ADD COLUMN base_ats_score INTEGER;
      `,
    },
    {
      // D55 (i) (10-07): THE TABLE'S CSV IMPORT KEEPS THE COMPANY'S WEBSITE. Duplicates and By company are
      // keyed by the D54 company identity, whose strongest evidence is the DOMAIN — and a past application
      // imported from a file has no posting and no logo-store row to carry one. Without this column two
      // same-named companies imported with different websites would merge the moment they were stored.
      // NULL: every row written before this, and every row whose domain comes from the logo store instead.
      id: "135_application_company_domain",
      sql: `
        ALTER TABLE job_applications ADD COLUMN company_domain TEXT;
      `,
    },
    {
      // D55 decision E (10-07): "REPORT THIS FORM" — a user-invoked report, from the extension, that an
      // application form is not recognised. It carries the form page's HOST and its field LABELS, never a
      // value and never a URL path or query (services/formReports.js refuses any other key). Linked to the
      // reporter so it is deleted with the account; kept 30 days (expires_at), then purged. The narrow
      // slice of D3's bug reporting (docs/BUG_REPORTING.md, not yet built) — folds into bug_reports later.
      id: "136_form_reports",
      sql: `
        CREATE TABLE IF NOT EXISTS form_reports (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          host              TEXT NOT NULL,
          labels_json       TEXT NOT NULL,
          field_count       INTEGER NOT NULL DEFAULT 0,
          extension_version TEXT,
          received_at       INTEGER NOT NULL,
          expires_at        INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_form_reports_user ON form_reports(user_id, received_at);
        CREATE INDEX IF NOT EXISTS idx_form_reports_expires ON form_reports(expires_at);
        CREATE INDEX IF NOT EXISTS idx_form_reports_host ON form_reports(host, received_at);
      `,
    },
    {
      // D59 (10-07): POSTINGS THAT ARRIVE AS RAW HTML AND LABEL BLOCKS. The normalised text goes in a NEW
      // column — `description` and `content_hash` are never rewritten, because A76's grades and the
      // enrichment imports are keyed on content_hash = sha1(title|description). description_text is NULL
      // when it would equal description (readers COALESCE); description_fields holds the label block's
      // fields; req_* the posting's stated citizenship / clearance (NULL = not read yet, never "none").
      // description_basis is a hash of the description they were read from: a reader serves them only
      // while it still matches, so a re-crawled posting's old text is never shown, and the next pass
      // re-reads it. services/jobs/descriptionText.js fills them (boot pass + backfill script).
      id: "137_description_text",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN description_text TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN description_fields TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN description_basis TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN req_citizenship TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN req_clearance TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN req_clearance_status TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN req_polygraph INTEGER;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_description_basis ON scraped_jobs(description_basis);
      `,
    },
    {
      // D65 (owner, 10-07): WORK HISTORY AND SKILLS COME FROM THE RÉSUMÉ IN THE PAYLOAD. The parse is
      // stored WITH the résumé it was read from — the tailored one in `resumes`, the base one in
      // `profile_base_resumes` (the active profile's) or `base_resume` — so a packet references it. parsed_basis is a hash of the
      // text it was parsed from: a résumé rewritten since is re-parsed on its next read, never served a
      // stale parse. services/payloadResume.js reads and writes them. NULL = not parsed yet.
      id: "138_resume_parse",
      sql: `
        ALTER TABLE resumes ADD COLUMN parsed_json TEXT;
        ALTER TABLE resumes ADD COLUMN parsed_basis TEXT;
        ALTER TABLE base_resume ADD COLUMN parsed_json TEXT;
        ALTER TABLE base_resume ADD COLUMN parsed_basis TEXT;
        ALTER TABLE profile_base_resumes ADD COLUMN parsed_json TEXT;
        ALTER TABLE profile_base_resumes ADD COLUMN parsed_basis TEXT;
      `,
    },
    {
      // D66 (owner, 10-07): A BASE-RÉSUMÉ-ONLY PAYLOAD. The user's switch: when 1, an application carries
      // the base résumé and no model is called for it (services/baseResumeOnly.js). Default 0 — nothing
      // changes for anyone who has not switched it on.
      id: "139_base_resume_only",
      sql: `
        ALTER TABLE users ADD COLUMN base_resume_only INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      // D67 (2) (owner, 10-07): THE SELF-LEARNING ORIGIN TABLE. A pair (posting host → apply host) learned
      // from a user's own verified "I submitted" on a host outside the job's family. apply_origin_pairs is
      // SHARED and carries no user identity — hostnames and a count; apply_origin_sightings counts the
      // DISTINCT users (promoted at 3) and offers a pair to the user who saw it, and goes with the account.
      // Hostnames only — never a path, a query or a URL. services/learnedOrigins.js.
      id: "140_apply_origin_pairs",
      sql: `
        CREATE TABLE IF NOT EXISTS apply_origin_pairs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          posting_host TEXT NOT NULL,
          apply_host TEXT NOT NULL,
          users_seen INTEGER NOT NULL DEFAULT 0,
          first_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
          promoted_at INTEGER,
          revoked_at INTEGER,
          UNIQUE(posting_host, apply_host)
        );
        CREATE TABLE IF NOT EXISTS apply_origin_sightings (
          pair_id INTEGER NOT NULL REFERENCES apply_origin_pairs(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (pair_id, user_id)
        );
      `,
    },
    {
      // D71 (owner, 10-08): PAY STATED IN THE PROSE. The derivation pass (services/jobs/descriptionText.js)
      // reads pay anywhere in the text into description_fields.pay (as stated, with its unit, source and
      // per-location lines); these two hold it as a USD-per-year ESTIMATE for the sort and the salary
      // filter only. The provider's salary_* columns are never written by it. NULL = none stated / not read.
      id: "141_pay_from_text",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN pay_text_min_usd INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN pay_text_max_usd INTEGER;
      `,
    },
    {
      // D75 (owner, 10-08): THE CRAWLER WORKER's queue, deny-list and observations — docs/CRAWLER_WORKER.md.
      // The worker holds no DB credentials; it leases from crawler_tasks and returns a signed result, and
      // draft decides what the result writes (services/crawlerQueue.js). crawler_denylist is DATA,
      // owner-editable, and wins over every task at queue AND lease time; seeded with the owner's list.
      // apply_origin_pairs gains what the crawler OBSERVED (J2): never promoted by it — the owner promotes.
      id: "142_crawler_worker",
      sql: `
        CREATE TABLE IF NOT EXISTS crawler_tasks (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          type           TEXT NOT NULL,
          input_json     TEXT NOT NULL,
          target_host    TEXT NOT NULL,
          status         TEXT NOT NULL DEFAULT 'queued',
          lease_until    INTEGER,
          attempts       INTEGER NOT NULL DEFAULT 0,
          result_status  TEXT,
          result_json    TEXT,
          refused_reason TEXT,
          created_by     INTEGER,
          created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
          finished_at    INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_crawler_tasks_status ON crawler_tasks(status, id);
        CREATE TABLE IF NOT EXISTS crawler_denylist (
          domain   TEXT PRIMARY KEY,
          reason   TEXT,
          added_by INTEGER,
          added_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        INSERT OR IGNORE INTO crawler_denylist (domain, reason) VALUES
          ('linkedin.com', 'terms restrict automated access'), ('indeed.com', 'terms restrict automated access'),
          ('glassdoor.com', 'terms restrict automated access'), ('ziprecruiter.com', 'terms restrict automated access'),
          ('monster.com', 'terms restrict automated access');
        ALTER TABLE apply_origin_pairs ADD COLUMN crawler_seen_at INTEGER;
        ALTER TABLE apply_origin_pairs ADD COLUMN crawler_hops_json TEXT;
      `,
    },
    {
      // D76 (owner, 10-09): RAILWAY WEBHOOK EVENTS — deploy status changes and alerts, so a failed deploy, a
      // crash or a volume alert is SEEN (a FAILED tools-service deploy went unnoticed; the volume once
      // reached 481 / 500 MB). Written ONLY by POST /api/hooks/railway (routes/railwayHook.js), which keeps
      // ids, never a commit message or an author, and never acts on what it records.
      id: "143_deploy_events",
      sql: `
        CREATE TABLE IF NOT EXISTS deploy_events (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type       TEXT NOT NULL,
          family           TEXT NOT NULL,
          state            TEXT,
          severity         TEXT,
          project_name     TEXT,
          environment_name TEXT,
          service_name     TEXT,
          service_id       TEXT,
          deployment_id    TEXT,
          commit_hash      TEXT,
          occurred_at      TEXT,
          received_at      INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_deploy_events_service ON deploy_events(service_name, id);
      `,
    },
    {
      // D75 STEP 0b (owner, 10-09): ADMIN → CRAWLER — the controls live in DRAFT's database, not in environment
      // variables, so changing them needs no redeploy. ONE row. It starts PAUSED and in DRY-RUN: nothing runs
      // until the owner presses Resume, and nothing reaches a website until the owner chooses Live.
      // CRAWLER_PAUSED (env) stays a second, independent kill switch. crawler_tasks records the mode a task
      // was leased in, where it came from, and the owner's "wrong answer" flag.
      id: "144_crawler_controls",
      sql: `
        CREATE TABLE IF NOT EXISTS crawler_state (
          id                 INTEGER PRIMARY KEY CHECK (id = 1),
          paused             INTEGER NOT NULL DEFAULT 1,
          mode               TEXT NOT NULL DEFAULT 'dry',
          per_run_cap        INTEGER NOT NULL DEFAULT 25,
          schedule_enabled   INTEGER NOT NULL DEFAULT 0,
          schedule_hhmm      TEXT NOT NULL DEFAULT '09:00',
          schedule_tasks     INTEGER NOT NULL DEFAULT 10,
          schedule_last_date TEXT,
          updated_at         INTEGER,
          updated_by         INTEGER
        );
        INSERT OR IGNORE INTO crawler_state (id) VALUES (1);
        ALTER TABLE crawler_tasks ADD COLUMN mode TEXT;
        ALTER TABLE crawler_tasks ADD COLUMN source TEXT;
        ALTER TABLE crawler_tasks ADD COLUMN flagged_wrong INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE crawler_tasks ADD COLUMN flag_note TEXT;
      `,
    },
    {
      // D75 STEP 1c (owner, 10-09): THE WORKER HAS NO DOMAIN AND NO HEALTHCHECK — so draft records when it last
      // heard from it, and what it answered, on every authenticated call (lease, status, result, release).
      // Admin → Crawler shows "worker last seen"; silence past a few polls reads as "not running".
      id: "145_crawler_worker_seen",
      sql: `
        ALTER TABLE crawler_state ADD COLUMN worker_last_seen INTEGER;
        ALTER TABLE crawler_state ADD COLUMN worker_last_call TEXT;
      `,
    },
    {
      // D78 (owner, 10-09): THE BOARD'S POLICY — one row, changed from Admin with no redeploy. The age limit
      // (120 days) applies to NEW postings at once (a too-old posting is never written); retiring EXISTING ones
      // (age_enforce) and the CS-only scope (scope_enforce) start OFF — each waits for the owner's go after its
      // dry run. services/jobs/boardAge.js reads it.
      id: "146_board_policy",
      sql: `
        CREATE TABLE IF NOT EXISTS board_policy (
          id             INTEGER PRIMARY KEY CHECK (id = 1),
          age_limit_days INTEGER NOT NULL DEFAULT 120,
          age_enforce    INTEGER NOT NULL DEFAULT 0,
          scope_enforce  INTEGER NOT NULL DEFAULT 0,
          updated_at     INTEGER,
          updated_by     INTEGER
        );
        INSERT OR IGNORE INTO board_policy (id) VALUES (1);
      `,
    },
    {
      // D80 (owner, 10-09): WHY IS THIS COMPANY HERE — the evidence stored with each configured company, so any
      // company's presence can be explained ("hn 2026-10, 4 months hiring; probe: 12 in-scope, 75% <= 120d").
      // services/companyList.js addCompany refuses an add without it.
      id: "147_company_evidence",
      sql: `
        ALTER TABLE company_ats_list ADD COLUMN evidence TEXT;
      `,
    },
    {
      // D82 B/C (owner, 10-09): THE CANDIDATE POOL — companies a discovery job FOUND, never companies it
      // added. Fed by HN "Who is hiring?" (services/jobs/hnDiscovery.js); probed read-only each night
      // (services/companyCandidates.js); approved or rejected by the owner in Admin -> Companies ->
      // Candidates. status: new -> probed -> approved / rejected -> added / dormant. A rejected row stays,
      // so the next sweep never re-queues it. discovery_breakers: one row per discovery source, opened
      // after 3 consecutive failures (D82 E); only the owner closes it.
      id: "148_company_candidates",
      sql: `
        CREATE TABLE IF NOT EXISTS company_candidates (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          company       TEXT    NOT NULL,
          ats_type      TEXT    NOT NULL,
          ats_slug      TEXT    NOT NULL COLLATE NOCASE,
          source        TEXT    NOT NULL,
          source_json   TEXT,
          evidence_json TEXT,
          rank_score    INTEGER,
          status        TEXT    NOT NULL DEFAULT 'new',
          status_reason TEXT,
          first_seen    INTEGER NOT NULL DEFAULT (unixepoch()),
          last_seen     INTEGER NOT NULL DEFAULT (unixepoch()),
          probed_at     INTEGER,
          decided_at    INTEGER,
          decided_by    INTEGER,
          UNIQUE (ats_type, ats_slug)
        );
        CREATE INDEX IF NOT EXISTS idx_company_candidates_status ON company_candidates(status, rank_score DESC);
        CREATE TABLE IF NOT EXISTS discovery_breakers (
          source     TEXT    PRIMARY KEY,
          failures   INTEGER NOT NULL DEFAULT 0,
          open       INTEGER NOT NULL DEFAULT 0,
          opened_at  INTEGER,
          last_error TEXT,
          updated_at INTEGER
        );
      `,
    },
    {
      // D74 P1 (owner, 10-08): "NEW SINCE YOUR LAST VISIT" — on FIRST SEEN, not the company's posted date.
      // board_seen_at is the last board load; board_prev_seen_at is the one before the current visit (a
      // gap of 30 minutes or more starts a new visit). services/boardVisit.js reads and rolls them.
      id: "149_board_visit",
      sql: `
        ALTER TABLE users ADD COLUMN board_seen_at INTEGER;
        ALTER TABLE users ADD COLUMN board_prev_seen_at INTEGER;
      `,
    },
    {
      // D84 F1 (owner, 10-09): THE EXPORT MUST NOT CUT THE MIDDLE. `description` is capped at ingest (5,000
      // characters, head + tail, "[…]" between — services/jobs/htmlToText.js) and `content_hash` is computed
      // from it, so it stays as it is: a rewrite would mark every enrichment and grade stale. The FULL plain
      // text goes in a new column, filled by the crawl; the enrichment export reads it, cleaned of boilerplate.
      // enrichment_partial = 1: the row's enrichment was read from CUT text, so it re-enters the backlog and its
      // skills_json may be replaced by the next import. Backfilled for every live import that read a cut text.
      id: "150_description_full",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN description_full TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN enrichment_partial INTEGER NOT NULL DEFAULT 0;
        UPDATE scraped_jobs SET enrichment_partial = 1
         WHERE enriched_at IS NOT NULL AND instr(description, '[…]') > 0
           AND job_id IN (SELECT r.job_id FROM enrichment_batch_rows r JOIN enrichment_batches b ON b.id = r.batch_id
                           WHERE b.source = 'import' AND b.reverted_at IS NULL);
      `,
    },
    {
      // D84 F2 (owner, 10-09): CRAWLER PLACEHOLDERS ARE NOT ENRICHMENT. A JSON map, enrichment column -> where its
      // value came from: crawler_fallback (a guess — the first 300 characters as summary, the lowercased title, the
      // title's level), source (the ATS stated it), board_location (the board's own location), import, owner.
      // A crawler_fallback value counts as EMPTY for the importer's "fill empty only"; an import or owner value is
      // never replaced without OVERWRITE. Written on insert by the crawl and by every import; a row from before this
      // migration is backfilled by DETECTION at boot (services/jobs/enrichmentProvenance.js).
      id: "151_enrichment_provenance",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN enrichment_provenance TEXT;
      `,
    },
    {
      // ⛔ D86 (owner, 10-09): BRING-YOUR-OWN-MODEL RÉSUMÉ. draft is an OAuth 2.1 authorization server for an MCP
      // client (Claude, ChatGPT): a CONNECTION is one user's grant to one client, revocable from Settings → Connected
      // apps; codes and tokens hang off it and are stored as SHA-256 hashes, never the value. A BRIEF is single-use,
      // bound to (user, job, base-résumé hash), expires, and allows 3 submissions. mcp_audit is one row per tool call.
      // users.byom_enabled is the user's master switch, OFF by default: nothing connects until they turn it on.
      // No column holds a model's output except through the résumé store. services/byom/.
      id: "152_byom_oauth",
      sql: `
        CREATE TABLE IF NOT EXISTS oauth_clients (
          client_id TEXT PRIMARY KEY,
          client_name TEXT,
          host TEXT NOT NULL,
          redirect_uris TEXT NOT NULL,
          registration TEXT NOT NULL DEFAULT 'dcr',
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS oauth_connections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          client_id TEXT NOT NULL,
          scope TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_used_at INTEGER,
          revoked_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_oauth_connections_user ON oauth_connections(user_id);
        CREATE TABLE IF NOT EXISTS oauth_codes (
          code_hash TEXT PRIMARY KEY,
          connection_id INTEGER NOT NULL REFERENCES oauth_connections(id) ON DELETE CASCADE,
          redirect_uri TEXT NOT NULL,
          code_challenge TEXT NOT NULL,
          resource TEXT NOT NULL,
          scope TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          used_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS oauth_tokens (
          token_hash TEXT PRIMARY KEY,
          connection_id INTEGER NOT NULL REFERENCES oauth_connections(id) ON DELETE CASCADE,
          kind TEXT NOT NULL,
          scope TEXT NOT NULL,
          resource TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          revoked_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_oauth_tokens_connection ON oauth_tokens(connection_id);
        CREATE TABLE IF NOT EXISTS byom_briefs (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          connection_id INTEGER,
          job_id TEXT NOT NULL,
          base_hash TEXT NOT NULL,
          base_json TEXT NOT NULL,
          base_ats_score INTEGER,
          attempts INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'open',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          expires_at INTEGER NOT NULL,
          used_at INTEGER,
          last_refusal TEXT,
          patch_hash TEXT,
          resume_version INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_byom_briefs_user ON byom_briefs(user_id, created_at);
        CREATE TABLE IF NOT EXISTS mcp_audit (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          connection_id INTEGER,
          tool TEXT NOT NULL,
          job_id TEXT,
          outcome TEXT NOT NULL,
          detail TEXT,
          at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_mcp_audit_user ON mcp_audit(user_id, at);
        ALTER TABLE users ADD COLUMN byom_enabled INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      // ⛔ Sessions A′ (owner, 10-09): THE STEP-UP CHECK READS THE IDENTITY THAT IS ACTING. A tab's token and the
      // browser's cookie can belong to two different accounts (two tabs, two sign-ins); the recent-sign-in check
      // for sensitive account changes read the COOKIE session's authAt while acting as the TOKEN's user. Each
      // auth context now carries its own sign-in time: set when a browser sign-in issues it, refreshed by
      // POST /api/account/reauth, NULL for session-less tokens (the extension, the phone).
      id: "153_auth_context_auth_at",
      sql: `
        ALTER TABLE auth_contexts ADD COLUMN auth_at INTEGER;
      `,
    },
    {
      // ⭐ D73 §B (owner, 10-09: email set up — Cloudflare Email Routing, Resend verified, EMAIL_FROM set). Marketing
      // consent stored honestly (a sign-up checkbox, OFF by default; when and where), the one-click unsubscribe's
      // stamp, the suppression list the Resend webhook fills (hard bounces, spam complaints — nothing is sent to an
      // address on it), and the notice log (who, when, which audience, how many — never the content).
      id: "154_email_consent",
      sql: `
        ALTER TABLE users ADD COLUMN marketing_opt_in INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN marketing_opt_in_at INTEGER;
        ALTER TABLE users ADD COLUMN marketing_opt_in_source TEXT;
        ALTER TABLE users ADD COLUMN unsubscribed_at INTEGER;
        CREATE TABLE IF NOT EXISTS email_suppressions (
          email TEXT PRIMARY KEY,
          reason TEXT NOT NULL,
          event_id TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS notice_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          admin_user_id INTEGER,
          audience TEXT NOT NULL,
          recipients INTEGER NOT NULL,
          sent INTEGER NOT NULL DEFAULT 0,
          skipped INTEGER NOT NULL DEFAULT 0,
          failed INTEGER NOT NULL DEFAULT 0,
          test INTEGER NOT NULL DEFAULT 0,
          at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      // ⭐ D88 P2 · user management: an account's status (suspend with a reason), per-user entitlement
      // overrides with a reason and an expiry (the resolver's second override source), private notes, and
      // the reason behind every admin write. Additive only.
      id: "155_user_management",
      sql: `
        ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
        ALTER TABLE users ADD COLUMN suspended_reason TEXT;
        ALTER TABLE users ADD COLUMN suspended_at INTEGER;
        ALTER TABLE admin_audit_log ADD COLUMN reason TEXT;
        CREATE TABLE IF NOT EXISTS user_entitlement_overrides (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          feature_key TEXT NOT NULL,
          value_json TEXT NOT NULL,
          reason TEXT NOT NULL,
          set_by INTEGER,
          set_at INTEGER NOT NULL DEFAULT (unixepoch()),
          expires_at INTEGER,
          revoked_at INTEGER,
          revoked_by INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_user_entitlement_overrides_live
          ON user_entitlement_overrides(user_id, feature_key, revoked_at);
        CREATE TABLE IF NOT EXISTS user_notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          body TEXT NOT NULL,
          author_id INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_user_notes_user ON user_notes(user_id, created_at);
      `,
    },
    {
      // ⭐ D88 P3 · support tickets: a user's request and its thread. Deleted with the account (cascade) and 24
      // months after it is solved (services/tickets.js). An internal note is a message with internal = 1.
      id: "156_support_tickets",
      sql: `
        CREATE TABLE IF NOT EXISTS tickets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          category TEXT NOT NULL,
          subject TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'open',
          priority TEXT NOT NULL DEFAULT 'normal',
          assignee INTEGER,
          source TEXT NOT NULL DEFAULT 'app',
          context_json TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          due_at INTEGER,
          solved_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_tickets_queue ON tickets(status, due_at);
        CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id, updated_at);
        CREATE TABLE IF NOT EXISTS ticket_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
          author_type TEXT NOT NULL,
          author_id INTEGER,
          body TEXT NOT NULL,
          internal INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id, id);
      `,
    },
    {
      // ⭐ D90 (owner 10-10): "base is the résumé the user uploaded — any change is compared against that, or the user
      // picks which two to compare." So no upload is lost: every distinct base the user saves is kept here (the
      // profile's base_resumes row is still the CURRENT one), and each tailored version records the upload it was
      // made from. content_hash is filled by the app (services/baseResumeHistory.js); the backfill's rows get theirs
      // on first read. Deleted with the account (cascade); moved on an account merge.
      id: "157_base_resume_uploads",
      sql: `
        CREATE TABLE IF NOT EXISTS base_resume_uploads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          profile_id INTEGER,
          name TEXT,
          content TEXT NOT NULL,
          content_hash TEXT,
          source TEXT NOT NULL DEFAULT 'upload',
          uploaded_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_base_resume_uploads_user ON base_resume_uploads(user_id, profile_id, uploaded_at);
        INSERT INTO base_resume_uploads (user_id, profile_id, name, content, source, uploaded_at)
          SELECT user_id, profile_id, name, content, 'backfill', COALESCE(updated_at, unixepoch())
          FROM profile_base_resumes WHERE TRIM(COALESCE(content, '')) != '';
        ALTER TABLE resume_versions ADD COLUMN base_upload_id INTEGER;
      `,
    },
    {
      // ⭐ D94 (owner 10-11): EMAIL HEALTH. Each verified Resend webhook event of a HANDLED type, keyed by its Svix id
      // so a retried delivery is recorded once — type, time, Resend's email_id and the provider's reason, NEVER the
      // recipient (services/emailHealth.js). Deleted after 90 days by the daily sweep. email_domain_status holds the
      // sending domain's last reported verification (domain.updated), so Admin can be told when it lapses.
      id: "158_email_events",
      sql: `
        CREATE TABLE IF NOT EXISTS email_events (
          svix_id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          received_at INTEGER NOT NULL DEFAULT (unixepoch()),
          email_id TEXT,
          detail TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_email_events_type_time ON email_events(type, received_at);
        CREATE TABLE IF NOT EXISTS email_domain_status (
          domain_id TEXT PRIMARY KEY,
          name TEXT,
          status TEXT NOT NULL,
          sending_ok INTEGER NOT NULL,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      // ⛔ D95 (owner 10-12): AN ADMIN IS NOT A USER. Admin accounts get their own table, their own sign-in links and
      // their own sessions — never a users row, so never a profile, résumé, draft, ticket, token or connected app.
      // Identities carry their kind in their shape: public_id adm_…, session tokens dft_adm_…, links dft_adml_…
      // (services/adminAccounts.js). Every admin-side write names its actor as a coded string — admin:adm_… · user:N ·
      // system (services/actor.js) — in admin_audit_log.actor and in an *_actor column beside each older integer
      // column, which keeps holding a users.id or NULL, never an admin id. The backfill is truthful: rows written by a
      // users row acting under the legacy is_admin flag are user:N; rows with no actor are system. Additive; the
      // switch (ADMIN_ACCOUNTS_ENFORCE) is off until the owner has proved the new sign-in.
      id: "159_admin_accounts",
      sql: `
        CREATE TABLE IF NOT EXISTS admin_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          public_id TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE COLLATE NOCASE,
          password_hash TEXT,
          password_set_at INTEGER,
          is_owner INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          created_by TEXT,
          disabled_at INTEGER,
          disabled_reason TEXT,
          last_sign_in_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS admin_sessions (
          token_hash TEXT PRIMARY KEY,
          admin_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          expires_at INTEGER NOT NULL,
          last_seen_at INTEGER,
          revoked_at INTEGER,
          user_agent TEXT,
          ip_hint TEXT,
          break_glass INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_id, revoked_at);
        CREATE TABLE IF NOT EXISTS admin_sign_in_links (
          token_hash TEXT PRIMARY KEY,
          admin_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          expires_at INTEGER NOT NULL,
          used_at INTEGER
        );
        ALTER TABLE admin_audit_log ADD COLUMN actor_kind TEXT;
        ALTER TABLE admin_audit_log ADD COLUMN actor TEXT;
        UPDATE admin_audit_log
          SET actor_kind = CASE WHEN admin_user_id IS NULL THEN 'system' ELSE 'user' END,
              actor = CASE WHEN admin_user_id IS NULL THEN 'system' ELSE 'user:' || admin_user_id END
          WHERE actor_kind IS NULL;
        ALTER TABLE user_entitlement_overrides ADD COLUMN set_by_actor TEXT;
        ALTER TABLE user_entitlement_overrides ADD COLUMN revoked_by_actor TEXT;
        UPDATE user_entitlement_overrides SET set_by_actor = 'user:' || set_by WHERE set_by IS NOT NULL AND set_by_actor IS NULL;
        UPDATE user_entitlement_overrides SET revoked_by_actor = 'user:' || revoked_by WHERE revoked_by IS NOT NULL AND revoked_by_actor IS NULL;
        ALTER TABLE user_notes ADD COLUMN author_actor TEXT;
        UPDATE user_notes SET author_actor = 'user:' || author_id WHERE author_id IS NOT NULL AND author_actor IS NULL;
        ALTER TABLE tickets ADD COLUMN assignee_actor TEXT;
        UPDATE tickets SET assignee_actor = 'user:' || assignee WHERE assignee IS NOT NULL AND assignee_actor IS NULL;
        ALTER TABLE ticket_messages ADD COLUMN author_actor TEXT;
        UPDATE ticket_messages SET author_actor = 'user:' || author_id WHERE author_id IS NOT NULL AND author_actor IS NULL;
        ALTER TABLE plan_upgrade_requests ADD COLUMN decided_by_actor TEXT;
        UPDATE plan_upgrade_requests SET decided_by_actor = 'user:' || decided_by WHERE decided_by IS NOT NULL AND decided_by_actor IS NULL;
        ALTER TABLE user_limits ADD COLUMN updated_by_actor TEXT;
        UPDATE user_limits SET updated_by_actor = 'user:' || updated_by WHERE updated_by IS NOT NULL AND updated_by_actor IS NULL;
        ALTER TABLE board_policy ADD COLUMN updated_by_actor TEXT;
        UPDATE board_policy SET updated_by_actor = 'user:' || updated_by WHERE updated_by IS NOT NULL AND updated_by_actor IS NULL;
        ALTER TABLE crawler_state ADD COLUMN updated_by_actor TEXT;
        UPDATE crawler_state SET updated_by_actor = 'user:' || updated_by WHERE updated_by IS NOT NULL AND updated_by_actor IS NULL;
        ALTER TABLE crawler_tasks ADD COLUMN created_by_actor TEXT;
        UPDATE crawler_tasks SET created_by_actor = 'user:' || created_by WHERE created_by IS NOT NULL AND created_by_actor IS NULL;
        ALTER TABLE crawler_denylist ADD COLUMN added_by_actor TEXT;
        UPDATE crawler_denylist SET added_by_actor = 'user:' || added_by WHERE added_by IS NOT NULL AND added_by_actor IS NULL;
        ALTER TABLE company_candidates ADD COLUMN decided_by_actor TEXT;
        UPDATE company_candidates SET decided_by_actor = 'user:' || decided_by WHERE decided_by IS NOT NULL AND decided_by_actor IS NULL;
        ALTER TABLE slug_harvest_sweeps ADD COLUMN actor TEXT;
        UPDATE slug_harvest_sweeps SET actor = CASE WHEN admin_user_id IS NULL THEN 'system' ELSE 'user:' || admin_user_id END WHERE actor IS NULL;
        ALTER TABLE slug_harvest_imports ADD COLUMN actor TEXT;
        UPDATE slug_harvest_imports SET actor = CASE WHEN admin_user_id IS NULL THEN 'system' ELSE 'user:' || admin_user_id END WHERE actor IS NULL;
        ALTER TABLE job_import_batches ADD COLUMN actor TEXT;
        UPDATE job_import_batches SET actor = CASE WHEN admin_user_id IS NULL THEN 'system' ELSE 'user:' || admin_user_id END WHERE actor IS NULL;
        ALTER TABLE notice_log ADD COLUMN actor TEXT;
        UPDATE notice_log SET actor = CASE WHEN admin_user_id IS NULL THEN 'system' ELSE 'user:' || admin_user_id END WHERE actor IS NULL;
      `,
    },
    {
      // ⭐ D86/D88 follow-up (owner 10-12, item 3): People → Users shows EVERY account by default; an account an admin
      // marks internal, test or beta can be hidden by a filter, and the list then says how many are hidden. One row per
      // (user, tag); who set it is a coded actor (D95). Gone with the account (cascade).
      id: "160_user_tags",
      sql: `
        CREATE TABLE IF NOT EXISTS user_tags (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          tag TEXT NOT NULL,
          set_at INTEGER NOT NULL DEFAULT (unixepoch()),
          set_by_actor TEXT,
          PRIMARY KEY (user_id, tag)
        );
      `,
    },
    {
      // ⭐ Extension, owner 10-12 (Zoom's Workday posting): ONE JOB, ONE KEY across the posting, /apply,
      // /apply/applyManually and /apply/useMyLastApplication (services/jobPageKey.js — workday|tenant|site|requisition).
      // A capture records which board job its key folded into, so every later stage resolves to the same job — even
      // when the board's copy of the job came from another ATS. Shared like the posting pool: a key and a job id,
      // never who captured it (job_captures keeps that, per user).
      id: "161_job_page_keys",
      sql: `
        CREATE TABLE IF NOT EXISTS job_page_keys (
          page_key TEXT PRIMARY KEY,
          job_id TEXT NOT NULL,
          rev INTEGER,
          canonical_url TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_job_page_keys_job ON job_page_keys(job_id);
      `,
    },
    {
      // ⛔ D95 PHASE 2 (owner 10-13: "password set and signed in with the admin email, now enforce"). An admin is an
      // admin account; no users row is one. The former admin row loses every credential it held (connected apps,
      // their tokens, its tab / extension / phone tokens) BEFORE its flag is cleared — cleared first, its Claude
      // connection would have started working as a person's — and is suspended (kept, with its reason, until it is
      // deleted after a backup; it owns no user data — WORKLOG 42). Each cleared row leaves an audit row. Then the
      // database itself refuses an admin flag on any users row, on insert and on update. server.js takes a backup
      // on the volume before this migration and holds it back if the backup fails.
      id: "162_no_admin_in_users",
      sql: `
        UPDATE oauth_tokens SET revoked_at = unixepoch()
          WHERE revoked_at IS NULL AND connection_id IN (SELECT id FROM oauth_connections WHERE user_id IN (SELECT id FROM users WHERE is_admin = 1));
        UPDATE oauth_connections SET revoked_at = unixepoch()
          WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM users WHERE is_admin = 1);
        UPDATE auth_contexts SET revoked_at = unixepoch()
          WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM users WHERE is_admin = 1);
        INSERT INTO admin_audit_log (admin_user_id, actor_kind, actor, action, target, before_json, after_json, reason)
          SELECT NULL, 'system', 'system', 'user.admin_flag_cleared', 'user:' || id,
                 '{"is_admin":1}', '{"is_admin":0,"status":"suspended"}', 'D95 Phase 2: admins are admin accounts'
          FROM users WHERE is_admin = 1;
        UPDATE users SET status = 'suspended', suspended_at = unixepoch(),
          suspended_reason = 'Former admin row (D95): admins are admin accounts now. Kept until it is deleted after a backup.'
          WHERE is_admin = 1;
        UPDATE users SET is_admin = 0 WHERE is_admin = 1;
        CREATE TRIGGER IF NOT EXISTS users_no_admin_insert BEFORE INSERT ON users
          WHEN NEW.is_admin IS NOT NULL AND NEW.is_admin != 0
          BEGIN SELECT RAISE(ABORT, 'D95: an admin is an admin account, never a users row'); END;
        CREATE TRIGGER IF NOT EXISTS users_no_admin_update BEFORE UPDATE OF is_admin ON users
          WHEN NEW.is_admin IS NOT NULL AND NEW.is_admin != 0
          BEGIN SELECT RAISE(ABORT, 'D95: an admin is an admin account, never a users row'); END;
      `,
    },
    {
      // ⛔ D95, the owner's word (10-13): "delete the suspended admin row". Only a row 162 retired — suspended with the
      // "Former admin row (D95)" reason — and nothing else. It owned no user data (WORKLOG 42); what it does hold goes
      // with it by the existing cascades (its notifications, sessions, tokens, its revoked connection, its plugin-call
      // log). The one reference that would block the delete — a plan request it decided (decided_by, a foreign key with
      // no cascade) — is cleared; the decision keeps its coded actor (decided_by_actor 'user:1'). History rows that name
      // it (the audit log, an override's set_by, a crawler setting's updated_by) are not constraints and stay as written,
      // each with its *_actor. An audit row records the delete. server.js backs up first and holds this back if it cannot.
      id: "163_delete_former_admin_row",
      sql: `
        UPDATE plan_upgrade_requests SET decided_by = NULL
          WHERE decided_by IN (SELECT id FROM users WHERE status = 'suspended' AND suspended_reason LIKE 'Former admin row (D95)%');
        UPDATE user_limits SET updated_by = NULL
          WHERE updated_by IN (SELECT id FROM users WHERE status = 'suspended' AND suspended_reason LIKE 'Former admin row (D95)%');
        INSERT INTO admin_audit_log (admin_user_id, actor_kind, actor, action, target, before_json, reason)
          SELECT NULL, 'system', 'system', 'user.delete', 'user:' || id, '{"username":"' || username || '","status":"suspended"}',
                 'D95: the former admin row, deleted on the owner''s word (10-13)'
          FROM users WHERE status = 'suspended' AND suspended_reason LIKE 'Former admin row (D95)%';
        DELETE FROM users WHERE status = 'suspended' AND suspended_reason LIKE 'Former admin row (D95)%';
      `,
    },
    {
      // ⭐ D96 §4 (owner 10-13): THE SAVED-ANSWER LIFECYCLE — one tick and an answer is remembered (eligibility and
      // disclosures included: the person's own stated answer, never a guess); an edit is RECORDED, the new value NOT
      // stored until re-acknowledged, the old one no longer auto-used. A TABLE, not more JSON on the profile: the key
      // is the normalised label + widget kind + option wording (shared/answerKey.js), so one label can hold two
      // questions (a different option list is a new question), and each answer needs its own state, source and dates.
      // custom_answers (label-only, the web's answers) stays as it is and keeps filling: those entries are marked
      // acknowledged at migration time, source legacy. answer_history: every change, from → to · when · which job.
      // The 90-day review reminder reads acknowledged_at / reviewed_at; answer_review_reminded_at makes the panel say
      // it once. Additive; both cascade with the account. services/answerLifecycle.js.
      id: "164_saved_answer_lifecycle",
      sql: `
        CREATE TABLE IF NOT EXISTS saved_answers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          question_key TEXT NOT NULL,
          widget_kind TEXT NOT NULL CHECK (widget_kind IN ('text','select','radio','checkbox','date')),
          options_key TEXT NOT NULL DEFAULT '',
          question TEXT NOT NULL,
          answer TEXT,
          state TEXT NOT NULL CHECK (state IN ('acknowledged','changed')),
          source TEXT NOT NULL CHECK (source IN ('you_typed','you_acknowledged','legacy')),
          category TEXT,
          acknowledged_at INTEGER,
          reviewed_at INTEGER,
          changed_at INTEGER,
          last_job_id TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE (user_id, question_key, widget_kind, options_key)
        );
        CREATE TABLE IF NOT EXISTS answer_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          question_key TEXT NOT NULL,
          widget_kind TEXT NOT NULL,
          options_key TEXT NOT NULL DEFAULT '',
          question TEXT NOT NULL,
          event TEXT NOT NULL CHECK (event IN ('changed','acknowledged','edited')),
          from_value TEXT,
          to_value TEXT,
          job_id TEXT,
          at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_answer_history_key ON answer_history(user_id, question_key, widget_kind, options_key);
        ALTER TABLE user_profile ADD COLUMN custom_answers_acknowledged_at INTEGER;
        ALTER TABLE user_profile ADD COLUMN answer_review_reminded_at INTEGER;
        UPDATE user_profile SET custom_answers_acknowledged_at = unixepoch()
          WHERE custom_answers IS NOT NULL AND json_valid(custom_answers) AND json_type(custom_answers) = 'object'
            AND EXISTS (SELECT 1 FROM json_each(user_profile.custom_answers) WHERE trim(CAST(value AS TEXT)) != '');
      `,
    },
    {
      // ⭐ D98 P1 (lane J3, 10-13): a résumé generated ON THE PAGE, asked for by the extension and made by the same
      // generation the web app uses (services/extensionResume.js). One row per request: its job, the hash of the base
      // résumé it is made from (once per job and base — the partial unique index), its status (queued · generating ·
      // ready · refused · failed · cancelled), the Draft slot it spent (a draft_slot_uses id, NULL-safe: a refund deletes
      // that row and stamps slot_refunded_at with the reason), the version it produced, the score pair, and the claim
      // guard's plain-words result. No content: the résumé itself is the resume_versions row. Cascades with the account.
      id: "165_extension_resume_generations",
      sql: `
        CREATE TABLE IF NOT EXISTS extension_resume_generations (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          base_hash TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('queued','generating','ready','refused','failed','cancelled')),
          regenerate INTEGER NOT NULL DEFAULT 0,
          reused INTEGER NOT NULL DEFAULT 0,
          slot_use_id INTEGER,
          slot_refunded_at INTEGER,
          refund_reason TEXT,
          resume_version INTEGER,
          score_before INTEGER,
          score_after INTEGER,
          guard_json TEXT,
          error_code TEXT,
          superseded_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          started_at INTEGER,
          finished_at INTEGER,
          cancelled_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_ext_resume_gen_user_job ON extension_resume_generations(user_id, job_id, base_hash);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_resume_gen_live ON extension_resume_generations(user_id, job_id, base_hash)
          WHERE superseded_at IS NULL AND status IN ('queued','generating','ready');
      `,
    },
    {
      // ⭐ D98 P1: the PDF the extension attaches, KEPT — ⚠ the one path where D16's "never store a PDF" is reversed,
      // so What we sent can show the exact file the page received (services/resumePdfArtifacts.js). The bytes with their
      // sha256 (checked on read), D16's 2 MB cap, the generation and version it was printed from (and the hash of that
      // HTML), when it was attached, and — once the application is recorded — its record and HTML snapshot row. A PDF on
      // a record lives as long as the record (cascade); one not on a record goes with the job's résumé or the account.
      id: "166_resume_pdf_artifacts",
      sql: `
        CREATE TABLE IF NOT EXISTS resume_pdf_artifacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          generation_id TEXT REFERENCES extension_resume_generations(id) ON DELETE SET NULL,
          resume_version INTEGER,
          html_sha256 TEXT NOT NULL,
          file_name TEXT NOT NULL,
          media_type TEXT NOT NULL DEFAULT 'application/pdf',
          sha256 TEXT NOT NULL,
          byte_size INTEGER NOT NULL,
          body BLOB NOT NULL,
          attached_at INTEGER,
          record_id INTEGER REFERENCES application_records(id) ON DELETE CASCADE,
          snapshot_artifact_id INTEGER REFERENCES application_artifacts(id) ON DELETE SET NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_resume_pdf_user_job ON resume_pdf_artifacts(user_id, job_id);
        CREATE INDEX IF NOT EXISTS idx_resume_pdf_generation ON resume_pdf_artifacts(generation_id);
        CREATE INDEX IF NOT EXISTS idx_resume_pdf_record ON resume_pdf_artifacts(record_id);
      `,
    },
    {
      // ⭐ T6 (field report 10-14): WHY a generation failed. Every failure was written error_code 'unavailable', so the owner's
      // Stripe failure (the tools service refused the model call) read the same as a crash. `cause` is "<stage>:<code>"
      // (services/extensionResume.js causeOf) — a code, never a message, a model name or money. The user's sentence stays
      // the generic one; the extension's "Show details" view shows the code.
      id: "167_extension_resume_cause",
      sql: `
        ALTER TABLE extension_resume_generations ADD COLUMN cause TEXT;
      `,
    },
    {
      // ⭐ T24 (field report 10-15) · the intent model's two settings and the remembered choice, with the ACCOUNT — not a
      // new browser storage key. JSON { onDraft: "queue" | "ask", manualResume: "on_cue" | "never", remembered: null |
      // "drafted" | "manual" } (routes/extensionDraft.js parseIntentSettings); NULL reads as the defaults.
      id: "168_extension_intent_settings",
      sql: `
        ALTER TABLE users ADD COLUMN extension_intent TEXT;
      `,
    },
    {
      // ⭐ D100 (owner 10-30, gates lifted): FULL AUTO is a per-user MODE, not a server constant. `send_mode` is
      // 'semi' | 'auto'; NULL reads as 'semi' (the default). `submitted_by` records whose submit it was — 'user' (they
      // approved these values) or 'auto' (their standing instruction) — on the run-job that sent it (D36 amended).
      id: "169_send_mode_submitted_by",
      sql: `
        ALTER TABLE users ADD COLUMN send_mode TEXT;
        ALTER TABLE apply_run_jobs ADD COLUMN submitted_by TEXT;
      `,
    },
    {
      // ⭐ D102 P4 / D100 P7: Auto settings — the user's FULL AUTO standing instruction (shared/autoSettings.js: daily cap,
      // run times + time zone, per-company limit, pause after an interview / offer, the board filters, the job profile) as
      // JSON, NULL = the defaults; and when the scheduler last ran for the user (services/autoScheduler.js).
      id: "170_auto_settings",
      sql: `
        ALTER TABLE users ADD COLUMN auto_settings TEXT;
        ALTER TABLE users ADD COLUMN auto_last_run_at INTEGER;
      `,
    },
    {
      // ⭐ D100 P2 / D79 · THE APPLY WORKER'S DATA (docs/APPLY_WORKER.md §3). draft stores CIPHERTEXT it cannot read: a
      // portal session sealed in the user's app to a per-session key the worker minted (key_id); revoke = the worker
      // destroys that key, so every copy — here and in backups — becomes unreadable. `portal_session_uses` is the use log
      // the user sees. `apply_remote_runs` is the worker's queue: one row per run-job sent to the worker, leased over the
      // signed API (routes/applyWorker.js), with the field list it filled (labels + values, never pixels).
      id: "171_apply_worker",
      sql: `
        CREATE TABLE IF NOT EXISTS portal_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          portal_family TEXT NOT NULL,
          origin_host TEXT NOT NULL,
          key_id TEXT NOT NULL,
          ciphertext TEXT NOT NULL,
          consent_at INTEGER NOT NULL,
          expires_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_used_at INTEGER,
          revoked_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_portal_sessions_user ON portal_sessions(user_id, revoked_at);
        CREATE TABLE IF NOT EXISTS portal_session_uses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL REFERENCES portal_sessions(id) ON DELETE CASCADE,
          apply_run_job_id INTEGER,
          started_at INTEGER NOT NULL DEFAULT (unixepoch()),
          outcome TEXT
        );
        CREATE TABLE IF NOT EXISTS apply_remote_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          run_job_id INTEGER NOT NULL UNIQUE,
          packet_id INTEGER,
          session_id INTEGER REFERENCES portal_sessions(id) ON DELETE SET NULL,
          mode TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'queued',
          worker_id TEXT,
          lease_until INTEGER,
          attempts INTEGER NOT NULL DEFAULT 0,
          field_list_json TEXT,
          approved_values_json TEXT,
          outcome TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_apply_remote_runs_state ON apply_remote_runs(state, lease_until);
      `,
    },
    {
      // ⭐ D100 (a), owner 10-30: "yes we are creating portal accounts". `portal_accounts` — an account the apply worker
      // creates FOR the user on a portal (Amazon first), with the user's OWN email (no alias) and a password the WORKER
      // generates. The credential is sealed to a key the worker minted for that account; draft stores ciphertext only and
      // never sees the password. Consent is per portal. `apply_remote_runs.account_id` — a run that signs in (or signs up)
      // with that account instead of an uploaded session.
      id: "172_portal_accounts",
      sql: `
        CREATE TABLE IF NOT EXISTS portal_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          portal_family TEXT NOT NULL,
          origin_host TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'requested',
          key_id TEXT,
          ciphertext TEXT,
          consent_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_stop TEXT,
          removed_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_portal_accounts_user ON portal_accounts(user_id, removed_at);
        ALTER TABLE apply_remote_runs ADD COLUMN account_id INTEGER;
      `,
    },
    {
      // ⭐ D101 P1 / P2 (owner 10-30) · THE PROFILE IN SECTIONS, AND APPLICATION DEFAULTS. One PERSON profile shared by all
      // of a user's job profiles, filled from the base résumé's parse (D65) on first open and offered — never applied
      // silently — after a new upload. ⛔ Editing it never rewrites the uploaded base résumé (the document stays the
      // document). `application_defaults` holds ONLY what the user SET (or answered in Needs you, D96): a row that is
      // absent is "not set", never a default pretending to be an answer (D72: every user read requires_sponsorship = 0).
      id: "173_structured_profile",
      sql: `
        CREATE TABLE IF NOT EXISTS profile_sections (
          user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          summary TEXT,
          imported_basis TEXT,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS profile_experience (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          company TEXT NOT NULL,
          title TEXT,
          location TEXT,
          start_ym TEXT,
          end_ym TEXT,
          is_current INTEGER NOT NULL DEFAULT 0,
          bullets_json TEXT NOT NULL DEFAULT '[]',
          position INTEGER NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'user'
        );
        CREATE TABLE IF NOT EXISTS profile_education (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          school TEXT NOT NULL,
          degree TEXT,
          field TEXT,
          start_ym TEXT,
          end_ym TEXT,
          position INTEGER NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'user'
        );
        CREATE TABLE IF NOT EXISTS profile_skills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          category TEXT,
          position INTEGER NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'user'
        );
        CREATE TABLE IF NOT EXISTS profile_links (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind TEXT NOT NULL,
          url TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS application_defaults (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          source TEXT NOT NULL,
          set_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, key)
        );
        CREATE INDEX IF NOT EXISTS idx_profile_experience_user ON profile_experience(user_id, position);
        CREATE INDEX IF NOT EXISTS idx_profile_education_user ON profile_education(user_id, position);
        CREATE INDEX IF NOT EXISTS idx_profile_skills_user ON profile_skills(user_id, position);
      `,
    },
    {
      // ⭐ D103 (owner 10-30) · THE INBOX — a FORWARDED COPY of the replies to the user's applications, never mailbox
      // access. Each user gets a private address `<token>@in.jobsviadraft.com` (a subdomain: its MX never touches the
      // root's), revocable at once. Messages are stored as capped TEXT (HTML stripped, attachments never stored), sorted
      // by rule (D17 — no model), matched to an application where they can be. A user's re-filing is counted per rule
      // (the input to improving them). `inbox_code_optins` / `inbox_code_uses` are D103 P5: the apply worker may read a
      // verification code for a portal ONLY where the user opted in for that portal, each read logged.
      id: "174_inbox",
      sql: `
        CREATE TABLE IF NOT EXISTS inbox_addresses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token TEXT NOT NULL UNIQUE,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          revoked_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS inbox_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          address_id INTEGER,
          provider_id TEXT,
          from_addr TEXT,
          from_domain TEXT,
          subject TEXT,
          body_text TEXT,
          received_at INTEGER NOT NULL DEFAULT (unixepoch()),
          category TEXT NOT NULL,
          category_source TEXT NOT NULL DEFAULT 'rule',
          rule TEXT,
          code TEXT,
          application_id INTEGER,
          UNIQUE(user_id, provider_id)
        );
        CREATE INDEX IF NOT EXISTS idx_inbox_messages_user ON inbox_messages(user_id, received_at);
        CREATE TABLE IF NOT EXISTS inbox_corrections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id INTEGER NOT NULL,
          rule TEXT,
          from_category TEXT,
          to_category TEXT,
          at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS inbox_code_optins (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          portal_family TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, portal_family)
        );
        CREATE TABLE IF NOT EXISTS inbox_code_uses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          message_id INTEGER NOT NULL,
          portal_family TEXT NOT NULL,
          remote_run_id INTEGER,
          at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      // ⭐ D107 (owner 10-30) · IS THIS POSTING ALIVE. One row per posting id that OUTLIVES its scraped_jobs row (the
      // cleanup deletes expired rows; dedup folds others), so a repost can be recognised after the posting it replaced
      // is gone: same company + title key + location, a near-same description (desc_sig, a minhash), first seen after
      // the earlier one. Written by services/jobs/jobHistory.js recordJobHistory — a rollup, never inside the crawl's
      // upsert. first_seen only moves earlier; closed_at clears when a closed posting is seen active again.
      id: "175_job_history",
      sql: `
        CREATE TABLE IF NOT EXISTS job_history (
          job_id      TEXT PRIMARY KEY,
          company_key TEXT NOT NULL,
          title_key   TEXT NOT NULL,
          loc_key     TEXT NOT NULL DEFAULT '',
          desc_sig    TEXT,
          posted_at   INTEGER,
          first_seen  INTEGER NOT NULL,
          last_seen   INTEGER NOT NULL,
          closed_at   INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_job_history_group ON job_history(company_key, title_key, first_seen);
      `,
    },
    {
      // ⭐ D106 P1 (owner 10-30) · THE REAL LEVEL. What the posting's text ASKS for (years, system design, leading
      // others, a prior internship, an advanced degree) → entry | early | mid | senior, beside the title's own level.
      // Written by services/jobs/levelRead.js with the tag pass; level_read_basis makes it idempotent. The board's
      // "Truly entry level" filter reads it (services/jobs/jobQuery.js truly_entry).
      id: "176_level_read",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN level_read TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN level_reasons TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN level_read_basis TEXT;
      `,
    },
    {
      // ⭐ D105 (owner 10-30) · THE ATLAS — a wiki of roles, skills, tools and stacks, linked. ⛔ ONE THESAURUS: there is
      // no alias table here — `alias_of` IS skill_synonyms (relation 'alias', confirmed), the scorer's own, so an alias
      // the Atlas shows is an alias the scorer scores (services/atlas/atlasStore.js). Nodes are seeded as DRAFT and only
      // a person publishes (D17: nothing generated by a model). atlas_node_stats is COMPUTED from active postings
      // (services/atlas/atlasStats.js) — never typed. atlas_wiki_cache holds Wikipedia's summary as WIKIPEDIA'S
      // (CC BY-SA, attributed), never blended into `definition`, which is draft's own words.
      id: "177_atlas",
      sql: `
        CREATE TABLE IF NOT EXISTS atlas_nodes (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          slug         TEXT NOT NULL UNIQUE,
          kind         TEXT NOT NULL CHECK (kind IN ('role', 'skill', 'tool', 'stack')),
          name         TEXT NOT NULL,
          term         TEXT NOT NULL,
          definition   TEXT,
          status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
          source       TEXT NOT NULL,
          wiki_title   TEXT,
          created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
          published_at INTEGER,
          published_by TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_atlas_nodes_term ON atlas_nodes(term);
        CREATE TABLE IF NOT EXISTS atlas_edges (
          from_id    INTEGER NOT NULL REFERENCES atlas_nodes(id) ON DELETE CASCADE,
          to_id      INTEGER NOT NULL REFERENCES atlas_nodes(id) ON DELETE CASCADE,
          type       TEXT NOT NULL CHECK (type IN ('requires', 'part_of', 'used_with', 'alternative_to', 'leads_to')),
          source     TEXT NOT NULL CHECK (source IN ('owner', 'registry', 'wikidata', 'onet', 'board')),
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (from_id, to_id, type)
        );
        CREATE INDEX IF NOT EXISTS idx_atlas_edges_to ON atlas_edges(to_id, type);
        CREATE TABLE IF NOT EXISTS atlas_resources (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          node_id      INTEGER NOT NULL REFERENCES atlas_nodes(id) ON DELETE CASCADE,
          url          TEXT NOT NULL,
          title        TEXT NOT NULL,
          level        TEXT,
          format       TEXT,
          hours        REAL,
          cost         TEXT,
          checked_at   INTEGER,
          check_status TEXT,
          added_by     TEXT,
          created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE (node_id, url)
        );
        CREATE TABLE IF NOT EXISTS atlas_wiki_cache (
          node_id       INTEGER PRIMARY KEY REFERENCES atlas_nodes(id) ON DELETE CASCADE,
          title         TEXT NOT NULL,
          extract       TEXT,
          thumbnail_url TEXT,
          page_url      TEXT NOT NULL,
          fetched_at    INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS atlas_node_stats (
          node_id         INTEGER PRIMARY KEY REFERENCES atlas_nodes(id) ON DELETE CASCADE,
          postings        INTEGER NOT NULL,
          top_skills_json TEXT NOT NULL DEFAULT '[]',
          top_roles_json  TEXT NOT NULL DEFAULT '[]',
          pay_min_usd     INTEGER,
          pay_median_usd  INTEGER,
          pay_max_usd     INTEGER,
          pay_n           INTEGER NOT NULL DEFAULT 0,
          computed_at     INTEGER NOT NULL
        );
      `,
    },
    {
      // ⭐ D108 P2 (owner 10-30) · "WHAT CHANGED" — a short dated list of rule changes that affect students and workers.
      // Each line is a fact with an OFFICIAL source link (services/kb/sponsorshipFacts.js addWhatChanged refuses any
      // other); no advice, no opinion. Removed lines are kept, marked, for the record.
      id: "178_what_changed",
      sql: `
        CREATE TABLE IF NOT EXISTS what_changed (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          happened_on TEXT NOT NULL,
          text        TEXT NOT NULL,
          source_url  TEXT NOT NULL,
          source_name TEXT NOT NULL,
          added_by    TEXT NOT NULL,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          removed_at  INTEGER
        );
      `,
    },
    {
      // ⭐ D112 d2 + e2 (owner 10-30 night). d2 · THE EDUCATION SECTION IS THE SOURCE OF THE DEGREE: the old Education
      // block's values (user_profile.highest_degree / field_of_study / university / graduation_year) move into the
      // section (profile_education) — NOT when an entry for the same school is already there (its empty degree / field are
      // filled instead), so nothing is listed twice. What cannot be a section entry is kept as the per-profile override
      // (user_profile.education_override, JSON): a degree with no school (only when the section is empty), and a graduation
      // year still to come (D101's date rule refuses a future end date on an entry). The forms and eligibility read the
      // derived value or that override (services/structuredProfile.js educationOf) — never the old columns again.
      // e2 · a job profile made from a résumé (A104) carries made_from_resume = 1 and shows "Refine your job profile"
      // until the wizard has been opened and SAVED for it (refined_at). Profiles made before this are not marked.
      id: "179_education_source",
      sql: `
        ALTER TABLE user_profile ADD COLUMN education_override TEXT;
        ALTER TABLE domain_profiles ADD COLUMN made_from_resume INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE domain_profiles ADD COLUMN refined_at INTEGER;
        UPDATE profile_education SET
          degree = COALESCE(NULLIF(TRIM(COALESCE(degree, '')), ''), (SELECT NULLIF(TRIM(COALESCE(up.highest_degree, '')), '') FROM user_profile up WHERE up.user_id = profile_education.user_id)),
          field = COALESCE(NULLIF(TRIM(COALESCE(field, '')), ''), (SELECT NULLIF(TRIM(COALESCE(up.field_of_study, '')), '') FROM user_profile up WHERE up.user_id = profile_education.user_id))
          WHERE EXISTS (SELECT 1 FROM user_profile up WHERE up.user_id = profile_education.user_id
            AND TRIM(COALESCE(up.university, '')) != '' AND LOWER(TRIM(up.university)) = LOWER(TRIM(profile_education.school)));
        INSERT INTO profile_education (user_id, school, degree, field, start_ym, end_ym, position, source)
          SELECT up.user_id, TRIM(up.university),
            NULLIF(TRIM(COALESCE(up.highest_degree, '')), ''),
            NULLIF(TRIM(COALESCE(up.field_of_study, '')), ''),
            NULL,
            CASE WHEN CAST(up.graduation_year AS INTEGER) BETWEEN 1900 AND CAST(strftime('%Y', 'now') AS INTEGER)
              THEN printf('%04d-01', CAST(up.graduation_year AS INTEGER)) END,
            COALESCE((SELECT MAX(pe.position) + 1 FROM profile_education pe WHERE pe.user_id = up.user_id), 0),
            'profile'
          FROM user_profile up
          WHERE TRIM(COALESCE(up.university, '')) != ''
            AND NOT EXISTS (SELECT 1 FROM profile_education pe WHERE pe.user_id = up.user_id
              AND LOWER(TRIM(pe.school)) = LOWER(TRIM(up.university)));
        UPDATE user_profile SET education_override = json_object(
            'degree', NULLIF(TRIM(COALESCE(highest_degree, '')), ''),
            'field', NULLIF(TRIM(COALESCE(field_of_study, '')), ''),
            'year', CASE WHEN CAST(graduation_year AS INTEGER) BETWEEN 1900 AND 2100 THEN CAST(graduation_year AS INTEGER) END)
          WHERE education_override IS NULL AND TRIM(COALESCE(university, '')) = ''
            AND (TRIM(COALESCE(highest_degree, '')) != '' OR TRIM(COALESCE(field_of_study, '')) != '')
            AND NOT EXISTS (SELECT 1 FROM profile_education pe WHERE pe.user_id = user_profile.user_id);
        UPDATE user_profile SET education_override = json_object('year', CAST(graduation_year AS INTEGER))
          WHERE education_override IS NULL AND TRIM(COALESCE(university, '')) != ''
            AND CAST(graduation_year AS INTEGER) > CAST(strftime('%Y', 'now') AS INTEGER) AND CAST(graduation_year AS INTEGER) <= 2100;
      `,
    },
    {
      // ⭐ D112 item 2 (owner 10-30) · THE GMAIL CONNECTION — beside D103's forwarding; the user picks either. Google OAuth
      // with gmail.readonly ONLY; draft reads only the messages a search query built from the applicant-tracking senders and
      // the user's applications' companies returns (services/gmail.js gmailQueryFor), never the rest of the mailbox, and each
      // goes through D103's one path (services/inbox.js ingestForUser). One row per user. The refresh token is SEALED with
      // the app's secret box (secret_enc / iv / auth_tag — the names the export's scrub drops), never stored plain.
      // `watermark` is the newest internalDate (seconds) read — the next poll's `after:`. Disconnect revokes the token at
      // Google and deletes the row. `inbox_messages.source` records which door a message came by ('forward' | 'gmail').
      id: "181_gmail_connection",
      sql: `
        CREATE TABLE IF NOT EXISTS gmail_connections (
          user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          google_email   TEXT,
          scope          TEXT NOT NULL,
          secret_enc     TEXT NOT NULL,
          iv             TEXT NOT NULL,
          auth_tag       TEXT NOT NULL,
          status         TEXT NOT NULL DEFAULT 'connected',
          watermark      INTEGER,
          last_polled_at INTEGER,
          last_error     TEXT,
          messages_read  INTEGER NOT NULL DEFAULT 0,
          connected_at   INTEGER NOT NULL DEFAULT (unixepoch())
        );
        ALTER TABLE inbox_messages ADD COLUMN source TEXT NOT NULL DEFAULT 'forward';
      `,
    },
    {
      // ⭐ 43s (owner, the Amazon run: "try to log into it, try resetting the password"). A portal account request may say
      // what to do when the user's email ALREADY has an account there: reset_existing = 1 lets the worker use the portal's
      // own Forgot password to set a new generated password (sealed like a created one; the emailed code comes only through
      // the user's code opt-in). 0 (the default): the run stops, account_exists — draft never guesses or holds a password.
      id: "182_portal_reset_existing",
      sql: `
        ALTER TABLE portal_accounts ADD COLUMN reset_existing INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      // ⭐ D112 item 8 (owner 10-30: "Web Push (VAPID, no vendor) + email through Resend now; FCM with Android"). Each event
      // stays ONE row in `notifications` (019); these two tables decide its copies. push_subscriptions: one row per browser
      // endpoint (the browser's own push service — services/webPush.js PUSH_HOSTS only), its RFC 8291 keys; a 404 / 410 from the
      // push service deletes the row. notification_prefs: the person's per-event switches (services/notify.js NOTIFY_EVENTS);
      // no row = the event's default. Both cascade with the user; the export drops endpoint and keys (secret columns).
      id: "183_web_push",
      sql: `
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          endpoint        TEXT    NOT NULL UNIQUE,
          key_p256dh      TEXT    NOT NULL,
          key_auth        TEXT    NOT NULL,
          user_agent      TEXT,
          failures        INTEGER NOT NULL DEFAULT 0,
          last_success_at INTEGER,
          created_at      INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
        CREATE TABLE IF NOT EXISTS notification_prefs (
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          event      TEXT    NOT NULL,
          push       INTEGER NOT NULL DEFAULT 0,
          email      INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, event)
        );
      `,
    },
    {
      // ⭐ D109 (owner 10-30) · PROOF — every claim on the résumé can carry its evidence. `profile_projects` is the Profile's
      // projects section (D101's shape). `profile_evidence` links a repository / live demo / paper / write-up (https only,
      // a kind, a short label) to an experience BULLET or a PROJECT, keyed by the bullet's normalised text or the project's
      // normalised name (services/proofLinks.js evidenceKey) so a reorder or a re-import keeps it. `proof_pages` is the
      // optional public page /p/<handle> — OFF by default (no row, or enabled = 0, is off); it lists projects and their links
      // and nothing private. ⛔ draft certifies nothing: the page says the links are supplied by the candidate.
      id: "184_proof_links",
      sql: `
        CREATE TABLE IF NOT EXISTS profile_projects (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name        TEXT NOT NULL,
          description TEXT,
          position    INTEGER NOT NULL DEFAULT 0,
          source      TEXT NOT NULL DEFAULT 'user'
        );
        CREATE TABLE IF NOT EXISTS profile_evidence (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          target     TEXT NOT NULL CHECK (target IN ('bullet', 'project')),
          target_key TEXT NOT NULL,
          kind       TEXT NOT NULL,
          label      TEXT NOT NULL,
          url        TEXT NOT NULL,
          position   INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS proof_pages (
          user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          handle     TEXT NOT NULL UNIQUE COLLATE NOCASE,
          enabled    INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_profile_projects_user ON profile_projects(user_id, position);
        CREATE INDEX IF NOT EXISTS idx_profile_evidence_user ON profile_evidence(user_id, target, target_key);
      `,
    },
    {
      // ⭐ D110 (owner 10-30) · INTERVIEW MODE — prep that starts when the interview email arrives (services/interviewPrep.js).
      // interview_prep: ONLY the date the user typed for an application (an emailed date is read by rule at read time, never
      // stored as theirs). interview_stories: the STAR story bank, per user, reused across interviews; `seed_key` remembers a
      // bullet already seeded from profile_experience so a second press adds only what is new. interview_debriefs and
      // interview_questions: after each round, what was asked and how it went — the user's OWN question bank, never shared
      // across users. All cascade with the user; a debrief outlives a deleted application (SET NULL) so the bank stays whole.
      id: "186_interview_mode",
      sql: `
        CREATE TABLE IF NOT EXISTS interview_prep (
          user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          application_id INTEGER NOT NULL REFERENCES application_records(id) ON DELETE CASCADE,
          date_ymd       TEXT,
          time_hm        TEXT,
          updated_at     INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, application_id)
        );
        CREATE TABLE IF NOT EXISTS interview_stories (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title       TEXT    NOT NULL,
          situation   TEXT    NOT NULL DEFAULT '',
          task        TEXT    NOT NULL DEFAULT '',
          action      TEXT    NOT NULL DEFAULT '',
          result      TEXT    NOT NULL DEFAULT '',
          themes_json TEXT    NOT NULL DEFAULT '[]',
          source      TEXT    NOT NULL DEFAULT 'user',
          seed_key    TEXT,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_stories_seed ON interview_stories(user_id, seed_key);
        CREATE TABLE IF NOT EXISTS interview_debriefs (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          application_id INTEGER REFERENCES application_records(id) ON DELETE SET NULL,
          round          TEXT    NOT NULL,
          held_on        TEXT,
          went           TEXT,
          notes          TEXT    NOT NULL DEFAULT '',
          created_at     INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_interview_debriefs_user ON interview_debriefs(user_id, application_id);
        CREATE TABLE IF NOT EXISTS interview_questions (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          debrief_id INTEGER NOT NULL REFERENCES interview_debriefs(id) ON DELETE CASCADE,
          round      TEXT    NOT NULL,
          question   TEXT    NOT NULL,
          went       TEXT,
          notes      TEXT    NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_interview_questions_user ON interview_questions(user_id, round);
      `,
    },
    {
      // ⭐ D108 P1 · sponsorship facts: the median wage, and the USCIS H-1B Employer Data Hub (owner 10-30).
      // WAGES — the LCA disclosure file's WAGE_RATE_OF_PAY_FROM / WAGE_UNIT_OF_PAY, annualised (Hour × 2080, Week × 52,
      // Bi-Weekly × 26, Month × 12) over CERTIFIED cases, kept per (employer, FEIN, period) as a histogram of $1k buckets
      // (services/kb/lcaWages.js) so a company's median over several entities and quarters is exact, not a median of
      // medians. company_lca_sponsorship.wage_by_fiscal_year_json is the roll-up, written by reconcileCompanyLca.
      // USCIS HUB — uscis_hub_employer_years holds the hub's rows summed per (employer key, tax-ID last four, fiscal
      // year); uscis_hub_source_files is the ledger (source URL, the file's own date). ⛔ ONE LCA MATCHER: the hub's
      // employers reach a company ONLY through the entities the LCA resolution already matched (lcaLayer.js) — the
      // same companyMatchKey, joined, never a second name matcher. company_lca_sponsorship.uscis_by_fiscal_year_json is
      // that roll-up. Additive only.
      id: "187_sponsorship_facts",
      sql: `
        ALTER TABLE lca_employer_periods ADD COLUMN wage_cases INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE lca_employer_periods ADD COLUMN wage_hist_json TEXT;
        ALTER TABLE company_lca_sponsorship ADD COLUMN wage_by_fiscal_year_json TEXT;
        ALTER TABLE company_lca_sponsorship ADD COLUMN uscis_by_fiscal_year_json TEXT;
        CREATE TABLE IF NOT EXISTS uscis_hub_employer_years (
          employer_key         TEXT    NOT NULL,
          tax_id4              TEXT    NOT NULL,
          fiscal_year          INTEGER NOT NULL,
          employer_name        TEXT    NOT NULL,
          state                TEXT,
          approvals            INTEGER NOT NULL DEFAULT 0,
          denials              INTEGER NOT NULL DEFAULT 0,
          initial_approvals    INTEGER,
          initial_denials      INTEGER,
          continuing_approvals INTEGER,
          continuing_denials   INTEGER,
          categories_json      TEXT,
          file_name            TEXT    NOT NULL,
          PRIMARY KEY (employer_key, tax_id4, fiscal_year)
        );
        CREATE INDEX IF NOT EXISTS idx_uscis_hub_employer_years_key ON uscis_hub_employer_years(employer_key);
        CREATE TABLE IF NOT EXISTS uscis_hub_source_files (
          file_name     TEXT    NOT NULL PRIMARY KEY,
          fiscal_years  TEXT    NOT NULL,
          source_url    TEXT,
          file_date     TEXT,
          layout        TEXT,
          data_rows     INTEGER NOT NULL DEFAULT 0,
          employer_rows INTEGER NOT NULL DEFAULT 0,
          byte_size     INTEGER,
          ingested_at   INTEGER NOT NULL
        );
      `,
    },
    {
      // ⭐ D113 P1 (owner 10-31) · REMOTE AUTO-APPLY — the picks loop on top of the FULL AUTO scheduler (services/picks.js,
      // services/autoScheduler.js). picks_runs: ONE row per (user, run time) — UNIQUE, so a crash or a second tick never
      // creates a run twice — with what the run looked at (seen), what it picked, the left-out counts BY REASON (JSON), when
      // its picks expire (the next run time), and the claim stamps that make the message / the start / the summary at most
      // once. picks: one row per picked job (rank, the D106 one line, its state offered | applied | passed | expired | auto,
      // whether the form is shown before sending, the single-use stamp of its confirm link). picks_left_out: the job ids
      // a run left out and why, kept 14 days (swept by the tick). Additive only.
      id: "188_picks",
      sql: `
        CREATE TABLE IF NOT EXISTS picks_runs (
          id                  INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          slot_at             INTEGER NOT NULL,
          mode                TEXT    NOT NULL,
          seen                INTEGER NOT NULL DEFAULT 0,
          picked              INTEGER NOT NULL DEFAULT 0,
          left_out_json       TEXT    NOT NULL DEFAULT '{}',
          expires_at          INTEGER NOT NULL,
          delivery_claimed_at INTEGER,
          delivery_json       TEXT,
          all_used_at         INTEGER,
          summary_sent_at     INTEGER,
          apply_run_id        INTEGER,
          created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE (user_id, slot_at)
        );
        CREATE TABLE IF NOT EXISTS picks (
          id                   INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          run_id               INTEGER NOT NULL REFERENCES picks_runs(id) ON DELETE CASCADE,
          job_id               TEXT    NOT NULL,
          rank                 INTEGER NOT NULL,
          title                TEXT,
          company              TEXT,
          line                 TEXT,
          score                REAL,
          state                TEXT    NOT NULL DEFAULT 'offered',
          review               INTEGER NOT NULL DEFAULT 0,
          token_used_at        INTEGER,
          acted_at             INTEGER,
          apply_status         INTEGER,
          apply_error          TEXT,
          question_sent_at     INTEGER,
          question_answered_at INTEGER,
          expires_at           INTEGER NOT NULL,
          created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE (run_id, job_id)
        );
        CREATE INDEX IF NOT EXISTS idx_picks_user_job ON picks(user_id, job_id);
        CREATE INDEX IF NOT EXISTS idx_picks_user_state ON picks(user_id, state);
        CREATE TABLE IF NOT EXISTS picks_left_out (
          run_id     INTEGER NOT NULL REFERENCES picks_runs(id) ON DELETE CASCADE,
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id     TEXT    NOT NULL,
          reason     TEXT    NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (run_id, job_id)
        );
        CREATE INDEX IF NOT EXISTS idx_picks_left_out_created ON picks_left_out(created_at);
      `,
    },
    {
      // ⭐ D105 P7–P9 (amended 10-31) · THE ATLAS PUBLISHES ITSELF. Additive only.
      // atlas_nodes.unpublished_by / unpublished_at — a PERSON's un-publish, recorded so the nightly auto-publish never
      // re-publishes that node (services/atlas/atlasPublish.js; the person publishing again clears it).
      // atlas_nodes.wiki_title_by — 'auto' (the nightly matcher: an exact, non-disambiguation article title) or 'owner'
      // (the curator set or cleared it; the matcher never overwrites it). wiki_checked_at — the matcher's last try.
      // atlas_nodes.wikidata_id (Q…, from the article's pageprops) and wikidata_checked_at — read once per item.
      // atlas_resources.source — 'wikidata' (P856 official website, P2078 user manual), 'wikipedia' (the article),
      // 'owner' (the curator's); the page lists them in that order (atlasStore.RESOURCE_ORDER_SQL).
      id: "189_atlas_publish",
      sql: `
        ALTER TABLE atlas_nodes ADD COLUMN unpublished_by TEXT;
        ALTER TABLE atlas_nodes ADD COLUMN unpublished_at INTEGER;
        ALTER TABLE atlas_nodes ADD COLUMN wiki_title_by TEXT;
        ALTER TABLE atlas_nodes ADD COLUMN wiki_checked_at INTEGER;
        ALTER TABLE atlas_nodes ADD COLUMN wikidata_id TEXT;
        ALTER TABLE atlas_nodes ADD COLUMN wikidata_checked_at INTEGER;
        ALTER TABLE atlas_resources ADD COLUMN source TEXT;
        UPDATE atlas_nodes SET wiki_title_by = 'owner' WHERE wiki_title IS NOT NULL;
        UPDATE atlas_resources SET source = 'owner' WHERE source IS NULL;
      `,
    },
    {
      // ⭐ BUG 10-31 · atlas_nodes.wiki_match — what the title matcher's last ANSWER for this node was: matched · missing ·
      // not_in_answer · disambiguation · inexact · not_software · no_item (services/atlas/atlasWikidata.js
      // WIKI_MATCH_CLASSES). Written with wiki_checked_at; NULL = never answered. Additive only.
      id: "190_atlas_wiki_match",
      sql: `
        ALTER TABLE atlas_nodes ADD COLUMN wiki_match TEXT;
      `,
    },
    {
      // ⭐ BUG 10-31 · the nodes the matcher set a title on BEFORE 190 carry no class, so Admin → Atlas counted them as
      // "never answered" (production: 62). An auto title, or a title with its Wikidata item, is a match.
      id: "191_atlas_wiki_match_backfill",
      sql: `
        UPDATE atlas_nodes SET wiki_match = 'matched'
          WHERE wiki_match IS NULL AND wiki_title IS NOT NULL AND TRIM(wiki_title) != ''
            AND (wiki_title_by = 'auto' OR wikidata_id IS NOT NULL);
      `,
    },
    {
      // ⭐ D105 P11 · drafted definitions, reviewed by the owner (services/atlas/atlasDefinitions.js). A definition pasted
      // back from a chat waits in definition_draft (definition_by = 'drafted') — never in `definition`, which is what
      // the public page shows and the publish bar counts; accepting moves it there with definition_by = 'owner'.
      id: "192_atlas_definition_draft",
      sql: `
        ALTER TABLE atlas_nodes ADD COLUMN definition_draft TEXT;
        ALTER TABLE atlas_nodes ADD COLUMN definition_by TEXT;
        UPDATE atlas_nodes SET definition_by = 'owner' WHERE TRIM(COALESCE(definition, '')) != '';
      `,
    },
    {
      // ⭐ D114 P5 · how often a posting's Atlas link is used: popup opens and Atlas visits, per day. A COUNT only — no
      // user, no term, no posting (services/atlas/atlasLinks.js countLinkEvent).
      id: "193_atlas_link_counts",
      sql: `
        CREATE TABLE IF NOT EXISTS atlas_link_counts (
          day   TEXT NOT NULL,
          event TEXT NOT NULL CHECK (event IN ('open', 'visit')),
          n     INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (day, event)
        );
      `,
    },
    {
      // ⭐ D115 P4 · two new kinds of Atlas node: 'concept' (the owner's tracker's 385 terms that are no existing node)
      // and 'pattern' (its 28 LeetCode patterns). SQLite cannot widen a CHECK in place, so atlas_nodes is REBUILT —
      // every column and row carried over with the same ids. ⛔ foreignKeys: "off" (scripts/applyMigrations.js): with
      // foreign keys on, the DROP cascades — rehearsed 10-31, it deleted every edge, stat, summary and resource.
      // The runner checks every reference inside the transaction and restores foreign keys after.
      id: "194_atlas_concept_pattern_kinds",
      foreignKeys: "off",
      sql: `
        CREATE TABLE atlas_nodes_new (
          id                  INTEGER PRIMARY KEY AUTOINCREMENT,
          slug                TEXT NOT NULL UNIQUE,
          kind                TEXT NOT NULL CHECK (kind IN ('role', 'skill', 'tool', 'stack', 'concept', 'pattern')),
          name                TEXT NOT NULL,
          term                TEXT NOT NULL,
          definition          TEXT,
          status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
          source              TEXT NOT NULL,
          wiki_title          TEXT,
          created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at          INTEGER NOT NULL DEFAULT (unixepoch()),
          published_at        INTEGER,
          published_by        TEXT,
          unpublished_by      TEXT,
          unpublished_at      INTEGER,
          wiki_title_by       TEXT,
          wiki_checked_at     INTEGER,
          wikidata_id         TEXT,
          wikidata_checked_at INTEGER,
          wiki_match          TEXT,
          definition_draft    TEXT,
          definition_by       TEXT
        );
        INSERT INTO atlas_nodes_new (id, slug, kind, name, term, definition, status, source, wiki_title, created_at, updated_at,
          published_at, published_by, unpublished_by, unpublished_at, wiki_title_by, wiki_checked_at, wikidata_id,
          wikidata_checked_at, wiki_match, definition_draft, definition_by)
        SELECT id, slug, kind, name, term, definition, status, source, wiki_title, created_at, updated_at,
          published_at, published_by, unpublished_by, unpublished_at, wiki_title_by, wiki_checked_at, wikidata_id,
          wikidata_checked_at, wiki_match, definition_draft, definition_by FROM atlas_nodes;
        DROP TABLE atlas_nodes;
        ALTER TABLE atlas_nodes_new RENAME TO atlas_nodes;
        CREATE INDEX IF NOT EXISTS idx_atlas_nodes_term ON atlas_nodes(term);
      `,
    },
    {
      // ⭐ D115 P3 · a learner's progress on the owner's tracker, so it follows them across devices: an ITEM done
      // (mark_id = the item's id, "s1-code") or a CHECKPOINT explained ("s1#c0" — the step and the checkpoint's place),
      // with the date. Signed out, the same marks live in the browser and are offered to the account on sign-in.
      id: "195_learn_progress",
      sql: `
        CREATE TABLE IF NOT EXISTS learn_progress (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          mark_id TEXT NOT NULL,
          state   TEXT NOT NULL CHECK (state IN ('done', 'explained')),
          at      INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, mark_id)
        );
      `,
    },
    {
      // ⭐ D118 P2 · the Learn content IN THE DATABASE — the owner's tracker (PARTS · ATLAS · INDEX · its copy) as one
      // validated JSON document per source. Production reads this, never the file: Admin → Atlas → Import content
      // replaces it (validated, diffed by id, applied on Apply), and content/learn/*.json seeds it ONLY while the table
      // is empty (a first install) — never over newer database content. `version` moves on every apply.
      // ⭐ D118 P2 (b) · atlas_changes: ONE counter, moved by triggers on every write to atlas_nodes and skill_synonyms,
      // so the in-memory Atlas indexes (the search, the posting links) rebuild on the next read after ANY change. Their
      // old key (count · newest updated_at · published count) missed two curator edits in the same second — measured:
      // publish B then unpublish A within a second left A in the public search. ⚠ A table rebuild (194's kind) drops
      // these triggers with the table: re-create them after it.
      id: "198_learn_content",
      sql: `
        CREATE TABLE IF NOT EXISTS learn_content (
          id          TEXT PRIMARY KEY,
          data        TEXT NOT NULL,
          version     INTEGER NOT NULL DEFAULT 1,
          imported_at INTEGER NOT NULL DEFAULT (unixepoch()),
          imported_by TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS atlas_changes (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          n  INTEGER NOT NULL DEFAULT 0
        );
        INSERT OR IGNORE INTO atlas_changes (id, n) VALUES (1, 0);
        CREATE TRIGGER IF NOT EXISTS atlas_nodes_changed_ins AFTER INSERT ON atlas_nodes BEGIN UPDATE atlas_changes SET n = n + 1 WHERE id = 1; END;
        CREATE TRIGGER IF NOT EXISTS atlas_nodes_changed_upd AFTER UPDATE ON atlas_nodes BEGIN UPDATE atlas_changes SET n = n + 1 WHERE id = 1; END;
        CREATE TRIGGER IF NOT EXISTS atlas_nodes_changed_del AFTER DELETE ON atlas_nodes BEGIN UPDATE atlas_changes SET n = n + 1 WHERE id = 1; END;
        CREATE TRIGGER IF NOT EXISTS skill_synonyms_changed_ins AFTER INSERT ON skill_synonyms BEGIN UPDATE atlas_changes SET n = n + 1 WHERE id = 1; END;
        CREATE TRIGGER IF NOT EXISTS skill_synonyms_changed_upd AFTER UPDATE ON skill_synonyms BEGIN UPDATE atlas_changes SET n = n + 1 WHERE id = 1; END;
        CREATE TRIGGER IF NOT EXISTS skill_synonyms_changed_del AFTER DELETE ON skill_synonyms BEGIN UPDATE atlas_changes SET n = n + 1 WHERE id = 1; END;
      `,
    },
    {
      // ⭐ D118 P1 · COUNTS MOVE WITH THE BOARD (services/atlas/atlasLive.js). The Atlas's counts are adjusted when a
      // posting is ingested, changed or closed, not only by the nightly recount:
      //   atlas_posting_match   each ACTIVE posting's reading by the one matcher — the nodes it is counted for, the nodes
      //                         it links (D114, published or not; a read keeps the published ones), its role, level and
      //                         company, its sentence hashes (the company's boilerplate counts) and the vocabulary key.
      //                         What a posting ADDED is what its close SUBTRACTS — never re-guessed.
      //   atlas_role_level_stats per role: its postings and the postings asking for each node, in all (level '') and per
      //                         level read; node_id 0 = the role's own postings (D116 YOUR MAP, D105 P12 role pages)
      //   atlas_live_state      the store's version (caches key on it), the baseline, the board's totals, the last drift
      //   atlas_posting_dirty   postings written since the last pass. ⛔ Filled by TRIGGERS on scraped_jobs, so no write
      //                         path can be missed — a crawl, an update, a close, an expiry, a delete, a script.
      // ⚠ A rebuild of scraped_jobs drops these triggers — re-create them in that migration.
      // ⛔ The triggers insert only when absent (WHERE NOT EXISTS), never INSERT OR IGNORE: the writing statement's own
      // conflict clause overrides a trigger body's, so the crawl's upsert (ON CONFLICT DO UPDATE) turned IGNORE into ABORT.
      id: "199_atlas_live_counts",
      sql: `
        CREATE TABLE IF NOT EXISTS atlas_posting_match (
          posting_id  INTEGER PRIMARY KEY,
          company_key TEXT NOT NULL DEFAULT '',
          role_id     INTEGER,
          level       TEXT,
          asked       TEXT NOT NULL DEFAULT '',
          linked      TEXT NOT NULL DEFAULT '',
          sentences   TEXT NOT NULL DEFAULT '',
          vocab       TEXT NOT NULL,
          matched_at  INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_atlas_posting_match_company ON atlas_posting_match(company_key);
        CREATE TABLE IF NOT EXISTS atlas_role_level_stats (
          role_id  INTEGER NOT NULL,
          level    TEXT NOT NULL,
          node_id  INTEGER NOT NULL,
          postings INTEGER NOT NULL,
          PRIMARY KEY (role_id, level, node_id)
        );
        CREATE TABLE IF NOT EXISTS atlas_live_state (
          k TEXT PRIMARY KEY,
          v TEXT
        );
        CREATE TABLE IF NOT EXISTS atlas_posting_dirty (
          posting_id INTEGER PRIMARY KEY
        );
        CREATE TRIGGER IF NOT EXISTS atlas_posting_ins AFTER INSERT ON scraped_jobs
          WHEN NEW.is_active = 1 AND NEW.duplicate_of IS NULL
          BEGIN INSERT INTO atlas_posting_dirty (posting_id) SELECT NEW.id WHERE NOT EXISTS (SELECT 1 FROM atlas_posting_dirty WHERE posting_id = NEW.id); END;
        CREATE TRIGGER IF NOT EXISTS atlas_posting_upd AFTER UPDATE OF is_active, duplicate_of, title, company, description, description_text, skills_json, level_read ON scraped_jobs
          WHEN ((OLD.is_active = 1 AND OLD.duplicate_of IS NULL) OR (NEW.is_active = 1 AND NEW.duplicate_of IS NULL))
            AND (OLD.is_active IS NOT NEW.is_active OR OLD.duplicate_of IS NOT NEW.duplicate_of OR OLD.title IS NOT NEW.title
              OR OLD.company IS NOT NEW.company OR OLD.description IS NOT NEW.description OR OLD.description_text IS NOT NEW.description_text
              OR OLD.skills_json IS NOT NEW.skills_json OR OLD.level_read IS NOT NEW.level_read)
          BEGIN INSERT INTO atlas_posting_dirty (posting_id) SELECT NEW.id WHERE NOT EXISTS (SELECT 1 FROM atlas_posting_dirty WHERE posting_id = NEW.id); END;
        CREATE TRIGGER IF NOT EXISTS atlas_posting_del AFTER DELETE ON scraped_jobs
          WHEN OLD.is_active = 1 AND OLD.duplicate_of IS NULL
          BEGIN INSERT INTO atlas_posting_dirty (posting_id) SELECT OLD.id WHERE NOT EXISTS (SELECT 1 FROM atlas_posting_dirty WHERE posting_id = OLD.id); END;
      `,
    },
    {
      // ⭐ D113 UI · the Draft House tree's leftovers, as the owner defined them 10-31 (WORKLOG). No new table.
      // interview_prep (D110's ONE store of the user's interview date) gains the time zone the user picked and
      // interview_at — that date and time in that zone as epoch seconds — so "Add the date" (an interview or an
      // assessment) is one source of truth: D110's countdown and Prep tab read the same row the tree's line does.
      // job_applications gains Note why's two private fields: rejection_note (≤ 500 characters, the user's words, never
      // read by a model — D17) and rejection_reasons (a JSON list of the quick picks, what D111 may later count).
      id: "200_draft_house_leftovers",
      sql: `
        ALTER TABLE interview_prep ADD COLUMN time_zone TEXT;
        ALTER TABLE interview_prep ADD COLUMN interview_at INTEGER;
        ALTER TABLE job_applications ADD COLUMN rejection_note TEXT;
        ALTER TABLE job_applications ADD COLUMN rejection_reasons TEXT;
      `,
    },
    {
      // ⭐ D116 M1 · THE TREE'S FAMILIES (owner 10-31): `family` is a STORED field on atlas_nodes — ML · Systems · Infra ·
      // Data · Backend (shared/atlasFamilies.js; more may be added there, so no CHECK: SQLite cannot widen one, see 194).
      // Assigned ONCE per node: the boot seed (content/atlas/families.json, reviewed by the owner) fills only a node whose
      // `family_by` is NULL, and a curator's choice in Admin → Atlas — set or cleared — writes `family_by` and sticks.
      // A node with no family is not drawn on the tree; it stays in search and on its page. After 200 (the Draft House leftovers).
      id: "201_atlas_node_family",
      sql: `
        ALTER TABLE atlas_nodes ADD COLUMN family TEXT;
        ALTER TABLE atlas_nodes ADD COLUMN family_by TEXT;
        CREATE INDEX IF NOT EXISTS idx_atlas_nodes_family ON atlas_nodes(family);
      `,
    },
    {
      // ⭐ D117 · LEARN AS A CIRCLE (owner 10-31, approved with C8: "make a progress bar the user may not mark themselves
      // complete"). The owner's tracker text stays in learn_content, untouched; the circle's own data sits beside it:
      //   learn_needs        "Before this" per piece (C2) — imported 'drafted' from content/learn/d117-data.json (C9); the
      //                      owner's review in Admin → Learn makes each 'accepted' or 'rejected'. A re-import never moves a
      //                      status (INSERT OR IGNORE by (step, need)), so his review is never undone.
      //   learn_teaches      the concept terms a piece teaches (C2, derived from the concept index) — resolved to Atlas
      //                      nodes on read, through the one thesaurus, so a new alias or node is picked up without a re-import
      //   learn_extra_items  D115 P5's games / exercises / practice links, optional, appended to their pieces on read;
      //                      'pending' until the dead-link checker has seen them, 'held' (listed for the owner) when dead
      //   learn_routes       guided routes as DATA (C5: a name + its target pieces; '*' = the whole circle), seeded here once
      //   learn_opened · learn_explanations · learn_builds — C8, progress EARNED, never ticked: an item opened FROM draft,
      //                      a checkpoint explained in the user's own words (private, never read by a model — D17), a link
      //                      to what was built. learn_progress (195, the old ticks) is kept as it is and no longer counts.
      // After 201 (the tree's families).
      id: "202_learn_circle",
      sql: `
        CREATE TABLE IF NOT EXISTS learn_needs (
          step_id     TEXT NOT NULL,
          need_id     TEXT NOT NULL,
          status      TEXT NOT NULL DEFAULT 'drafted' CHECK (status IN ('drafted', 'accepted', 'rejected')),
          source      TEXT NOT NULL DEFAULT 'import',
          position    INTEGER NOT NULL DEFAULT 0,
          reviewed_by TEXT,
          updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (step_id, need_id)
        );
        CREATE TABLE IF NOT EXISTS learn_teaches (
          step_id  TEXT NOT NULL,
          term     TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (step_id, term)
        );
        CREATE TABLE IF NOT EXISTS learn_extra_items (
          id          TEXT PRIMARY KEY,
          step_id     TEXT NOT NULL,
          k           TEXT NOT NULL,
          t           TEXT NOT NULL,
          s           TEXT,
          u           TEXT NOT NULL,
          o           INTEGER NOT NULL DEFAULT 1,
          position    INTEGER NOT NULL DEFAULT 0,
          status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'held')),
          checked_at  INTEGER,
          check_note  TEXT,
          imported_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS learn_routes (
          id         TEXT PRIMARY KEY,
          name       TEXT NOT NULL,
          targets    TEXT NOT NULL,
          position   INTEGER NOT NULL DEFAULT 0,
          updated_by TEXT,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        INSERT OR IGNORE INTO learn_routes (id, name, targets, position, updated_by) VALUES
          ('all', 'The whole circle', '*', 0, 'seed:202'),
          ('k8s', 'Make sense of Kubernetes', '["o4"]', 1, 'seed:202'),
          ('backend-senior', 'Backend → senior', '["x2","x1","b2","w2","o3","l2"]', 2, 'seed:202'),
          ('system-design', 'System design interviews', '["x2","x1","b2","d3","g4"]', 3, 'seed:202');
        CREATE TABLE IF NOT EXISTS learn_opened (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          item_id TEXT NOT NULL,
          step_id TEXT NOT NULL,
          at      INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, item_id)
        );
        CREATE TABLE IF NOT EXISTS learn_explanations (
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          checkpoint_id TEXT NOT NULL,
          step_id       TEXT NOT NULL,
          body          TEXT NOT NULL,
          words         INTEGER NOT NULL,
          created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, checkpoint_id)
        );
        CREATE TABLE IF NOT EXISTS learn_builds (
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          step_id    TEXT NOT NULL,
          url        TEXT NOT NULL,
          kind       TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, step_id)
        );
        CREATE INDEX IF NOT EXISTS idx_learn_needs_need ON learn_needs(need_id);
      `,
    },
    {
      // ⭐ D121 P2 · H-1B SPONSORSHIP SIGNALS — the title level. The DOL OFLC LCA disclosure file's certified cases,
      // per employer × fiscal period × TITLE FAMILY (shared/lcaTitleKey.js: the job title with its level words removed,
      // so "Senior Software Engineer II" and "Software Engineer" are one family), written by scripts/ingestLca.mjs in the
      // SAME transaction as lca_employer_periods (a re-import of a period deletes and re-inserts both):
      //   certified       certified cases for that family
      //   wage_cases · wage_hist_json   the offered wage (WAGE_RATE_OF_PAY_FROM, annualised — services/kb/lcaWages.js),
      //                   $1k-bucket histogram, so a median over many entities and quarters is exact to the bucket
      //   level_json      the prevailing-wage level the case was filed at (PW_WAGE_LEVEL: I · II · III · IV) → count
      // Only employers with certified cases, only the top families per employer (the ingest's cap). Public data; no
      // person's name, contact or wage is stored — counts and buckets only. After 202 (the circle).
      id: "203_lca_employer_titles",
      sql: `
        CREATE TABLE IF NOT EXISTS lca_employer_titles (
          employer_key   TEXT    NOT NULL,
          fein           TEXT    NOT NULL,
          fiscal_period  TEXT    NOT NULL,
          title_key      TEXT    NOT NULL,
          certified      INTEGER NOT NULL DEFAULT 0,
          wage_cases     INTEGER NOT NULL DEFAULT 0,
          wage_hist_json TEXT,
          level_json     TEXT,
          PRIMARY KEY (employer_key, fein, fiscal_period, title_key)
        );
        CREATE INDEX IF NOT EXISTS idx_lca_employer_titles_period ON lca_employer_titles(fiscal_period);
      `,
    },
    {
      // ⭐ D119 · THUMBNAILS — every resource shows what it is before it is opened (owner 10-31). One row per resource URL
      // (url_hash = sha256 of the URL, hex), written by services/thumbs/resourceThumbs.js and read by GET /api/thumbs:
      //   kind        what the picture is: youtube (a watch URL's own thumbnail) · youtube_search (no single video, so no
      //               picture is invented) · book (Open Library's cover for the title + author) · site (the page's own
      //               og:image / twitter:image) · none (a fallback tile)
      //   bytes / content_type   the picture as FETCHED ONCE and stored (≤ 2 MB, sniffed by its first bytes — never
      //               hot-linked); null when there is none
      //   title · attribution    YouTube oEmbed's title and channel; "Cover: Open Library"; the site's host
      //   pinned_url  Admin → Learn "Pin a video": a watch URL an admin chose for a search link → the real thumbnail
      //   hidden_at / hidden_by  Admin's one-press takedown; a hidden picture is never served (the tile falls back)
      //   status      ok · none · failed — a failed fetch keeps the fallback tile and is tried again on the next refresh
      // After 203 (the LCA title families).
      id: "204_resource_thumbs",
      sql: `
        CREATE TABLE IF NOT EXISTS resource_thumbs (
          url_hash     TEXT PRIMARY KEY,
          url          TEXT NOT NULL,
          kind         TEXT NOT NULL CHECK (kind IN ('youtube', 'youtube_search', 'book', 'site', 'none')),
          status       TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('ok', 'none', 'failed')),
          bytes        BLOB,
          content_type TEXT,
          title        TEXT,
          attribution  TEXT,
          note         TEXT,
          pinned_url   TEXT,
          pinned_by    TEXT,
          hidden_at    INTEGER,
          hidden_by    TEXT,
          fetched_at   INTEGER,
          updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      // ⭐ D124 · THE TRIAL (owner 11-01, twice amended): THE TRIAL IS THE MAIN FRAME — every account made from now on is a
      // trial account unless an admin grants it full access; 2 Drafts, then the whole site locks and ends in the survey and
      // a coming-soon page. A sample résumé sends to draft's practice form, the tester's own sends for real.
      //   users.full_access     NULL = by age (an account made before trial_since keeps full access) · 1 = granted · 0 = trial
      //   users.full_access_at / full_access_by   when and by which admin it was last set
      //   users.trial_at        when the account was first seen in the trial; users.trial_resume 'A' | 'B' | 'own'
      //   users.trial_survey_dismissed_at   the survey was skipped at the end · users.trial_finished_at "Finish the trial"
      //   trial_config          trial_since = when this migration ran (no existing row is changed)
      //   trial_events          the trial's analytics: pages visited and active minutes — names and counts, no content
      //   trial_surveys         the survey's answers, one row per account (answers JSON: the D124 questions)
      //   trial_feedback        "Something broke? / Feedback": a short text and the screen it came from
      //   practice_submissions  a send that reached draft's practice form — counts only, never the form's values
      // After 204 (the resource thumbnails).
      id: "205_trial",
      sql: `
        ALTER TABLE users ADD COLUMN trial_at INTEGER;
        ALTER TABLE users ADD COLUMN trial_resume TEXT;
        ALTER TABLE users ADD COLUMN trial_survey_dismissed_at INTEGER;
        ALTER TABLE users ADD COLUMN trial_finished_at INTEGER;
        ALTER TABLE users ADD COLUMN full_access INTEGER;
        ALTER TABLE users ADD COLUMN full_access_at INTEGER;
        ALTER TABLE users ADD COLUMN full_access_by TEXT;
        CREATE TABLE IF NOT EXISTS trial_config (
          key   TEXT PRIMARY KEY,
          value INTEGER NOT NULL
        );
        INSERT OR IGNORE INTO trial_config (key, value) VALUES ('trial_since', unixepoch());
        CREATE TABLE IF NOT EXISTS trial_events (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER NOT NULL,
          event      TEXT NOT NULL,
          detail     TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_trial_events_user ON trial_events(user_id, event);
        CREATE TABLE IF NOT EXISTS trial_surveys (
          user_id    INTEGER PRIMARY KEY,
          answers    TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS trial_feedback (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER NOT NULL,
          screen     TEXT,
          body       TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_trial_feedback_user ON trial_feedback(user_id);
        CREATE TABLE IF NOT EXISTS practice_submissions (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id         INTEGER,
          job_id          TEXT NOT NULL,
          fields_filled   INTEGER NOT NULL DEFAULT 0,
          resume_attached INTEGER NOT NULL DEFAULT 0,
          created_at      INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_practice_submissions_user ON practice_submissions(user_id);
      `,
    },
    {
      // ⭐ A108 · APIFY, SCRAPPED (owner 11-01): "scrap the entire apify module and pathways". No route writes or reads a
      // token any more; the ones people once pasted are third-party credentials draft should not keep. A DATA migration
      // (it changes rows): backed up first, like 162 / 163 / 194 (server.js DATA_MIGRATIONS). The column stays — dropping
      // it on the volume buys nothing and nothing reads it.
      // After 205 (the trial).
      id: "206_scrub_apify_tokens",
      sql: `
        UPDATE users SET apify_token = NULL WHERE apify_token IS NOT NULL;
      `,
    },
    {
      // ⭐ D126 + D127 · EVERY POSTING IN ONE CATEGORY (owner 11-01): the CS-only gate lifted to all professional roles,
      // and nothing shown from an unknown category. services/jobs/professionalScope.js decides; the crawl's gate and a
      // boot backfill write it here (board_category: sj.category is an older, unwritten column). NULL = not classified yet (shown, like CC1b's soft null); 'held' = never
      // shown on any board (the red-flag rule); category_reason says why. After 206.
      id: "207_posting_category",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN board_category TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN soc TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN discipline TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN category_confidence REAL;
        ALTER TABLE scraped_jobs ADD COLUMN category_reason TEXT;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_board_category ON scraped_jobs(board_category);
      `,
    },
    {
      // ⭐ 43y FIX (11-01): D121's sponsorship signal reads lca_employer_periods BY EMPLOYER NAME for every board row
      // (sponsorshipSignal.titleFacts), and nothing indexed employer_name — a 2.5 s scan of 481,588 rows per row, 50 rows
      // a page: the daily deck's deal blocked the whole server for minutes on a new account (the owner's trial walk,
      // 11-01: "no jobs or picks"). Measured on a copy: 2,562 ms -> 0 ms a lookup; the index builds in 0.5 s. After 207.
      id: "208_lca_employer_name_index",
      sql: `
        CREATE INDEX IF NOT EXISTS idx_lca_employer_periods_name ON lca_employer_periods(employer_name);
      `,
    },
    {
      // ⭐ D130 (owner 11-01) · THE STANDALONE SURVEY — jobsviadraft.com/survey, no account: a response's name and email
      // are its only identity, one response per email (email_key, lower-cased; a second submission updates the first).
      // Beside trial_surveys (keyed by the account), not in it: that table's key is the user, and these have none.
      // After 208.
      id: "209_standalone_surveys",
      sql: `
        CREATE TABLE IF NOT EXISTS standalone_surveys (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          name       TEXT NOT NULL,
          email      TEXT NOT NULL,
          email_key  TEXT NOT NULL UNIQUE,
          answers    TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      // ⭐ THE TRIAL'S DEMONSTRATION (owner 11-01): a sample's tailored résumé for a posting — simulated, no model (the
      // sample re-arranged for the posting's terms) — made once and replayed for every later tester on that sample
      // (services/trialDemo.js). No person's data: the sample is a fictional person. After 209.
      id: "210_trial_demo_tailoring",
      sql: `
        CREATE TABLE IF NOT EXISTS trial_demo_tailoring (
          sample_id    TEXT NOT NULL,
          job_id       TEXT NOT NULL,
          changes_json TEXT NOT NULL,
          ats_after    INTEGER,
          created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (sample_id, job_id)
        );
      `,
    },
    {
      // ⭐ D125 (owner 11-01): the owner calibrates the ATS by hand (services/atsCalibration.js, Admin → ATS calibration).
      // A set is FROZEN per version — each posting's text, the sentences the board counts and draft's reading at the time —
      // so every later scorer change is measured on the same pairs. Résumés: the admin's own (copied in), the trial's
      // samples, any he uploads. Reviews hold his marks; suggestions from the optional assist stay apart until he accepts
      // them. Fixes are queued for the agent; baselines feed the regression gate (scripts/d125GoldGate.mjs). After 210.
      id: "211_ats_gold",
      sql: `
        CREATE TABLE IF NOT EXISTS ats_gold_items (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          version       INTEGER NOT NULL,
          job_id        TEXT NOT NULL,
          category      TEXT,
          discipline    TEXT,
          level         TEXT,
          title         TEXT,
          company       TEXT,
          posting_text  TEXT NOT NULL,
          counted_json  TEXT NOT NULL DEFAULT '[]',
          reading_json  TEXT NOT NULL,
          created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE (version, job_id)
        );
        CREATE TABLE IF NOT EXISTS ats_gold_resumes (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          label         TEXT NOT NULL,
          source        TEXT NOT NULL,
          resume_text   TEXT NOT NULL,
          created_at    INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS ats_gold_reviews (
          item_id          INTEGER PRIMARY KEY REFERENCES ats_gold_items(id) ON DELETE CASCADE,
          marks_json       TEXT NOT NULL DEFAULT '{}',
          added_json       TEXT NOT NULL DEFAULT '{}',
          tiers_json       TEXT NOT NULL DEFAULT '{}',
          scores_json      TEXT NOT NULL DEFAULT '{}',
          suggestions_json TEXT,
          done             INTEGER NOT NULL DEFAULT 0,
          reviewed_by      INTEGER,
          updated_at       INTEGER
        );
        CREATE TABLE IF NOT EXISTS ats_gold_fixes (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          kind        TEXT NOT NULL,
          term        TEXT NOT NULL,
          why         TEXT,
          status      TEXT NOT NULL DEFAULT 'queued',
          queued_by   INTEGER,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE (kind, term)
        );
        CREATE TABLE IF NOT EXISTS ats_gold_baselines (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          version      INTEGER NOT NULL,
          metrics_json TEXT NOT NULL,
          recorded_by  INTEGER,
          created_at   INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      // ⭐ D123 P6a / P6d / P6g + the owner's model choice (11-01, contract 1.8.0). users.tailoring_model: the model a
      // person picked for their tailorings (haiku · sonnet · open), honoured only while Admin → Ops offers it
      // (services/leanTailoring.js modelFor). resume_gists: the per-employer gists of a base résumé, built ONCE on the
      // Sonnet tier (POST /v1/resumes/gists) and keyed by the résumé's hash, so a changed résumé gets new ones; `edited`
      // marks the person's own wording (never overwritten by a rebuild of the same résumé); numberless_json lists the
      // bullets with no number for the optional "add a real number" prompt (P6g). user_profile.coursework_json: the
      // person's own courses, for P6d's Relevant Coursework row. After 211.
      id: "212_tailoring_choice",
      sql: `
        ALTER TABLE users ADD COLUMN tailoring_model TEXT;
        ALTER TABLE user_profile ADD COLUMN coursework_json TEXT;
        CREATE TABLE IF NOT EXISTS resume_gists (
          user_id          INTEGER NOT NULL,
          resume_hash      TEXT NOT NULL,
          gists_json       TEXT NOT NULL DEFAULT '[]',
          numberless_json  TEXT NOT NULL DEFAULT '[]',
          edited           INTEGER NOT NULL DEFAULT 0,
          cost_usd         REAL,
          created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at       INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, resume_hash)
        );
      `,
    },
    {
      // ⭐ D137 (owner 11-02) · THE GHOST SCORE. scraped_jobs.ghost_level: NULL = nothing against the posting,
      // 1 = Uncertain, 2 = Likely not hiring — the board's order (ranked down, never removed) and its "Hide likely not
      // hiring" filter read it. job_ghost: the evidence the card shows, and flagged_at — the FIRST time a posting was
      // flagged, never cleared, so the monthly calibration reads applications sent after the flag. Written by
      // services/jobs/ghostScore.js scoreGhosts after D107's history rollup. Not a trigger column of 199. After 212.
      id: "213_ghost_score",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN ghost_level INTEGER;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_ghost ON scraped_jobs(ghost_level) WHERE ghost_level IS NOT NULL;
        CREATE TABLE IF NOT EXISTS job_ghost (
          job_id         TEXT PRIMARY KEY,
          level          INTEGER NOT NULL,
          points         INTEGER NOT NULL DEFAULT 0,
          evidence_json  TEXT NOT NULL DEFAULT '[]',
          scored_at      INTEGER NOT NULL,
          flagged_at     INTEGER
        );
      `,
    },
    {
      // ⭐ D136 P3 (owner 11-02) · BEST BETS' CALIBRATION. The signals an application had when it was SENT (fit against the
      // must-haves, level, freshness, the ghost level, the company's closings), stored once per (user, posting) by
      // services/bestBets.js recordApplicationSignals from writeApplication; the first send wins. The monthly refit joins
      // it to job_applications' outcome. Merge plan keepInto. After 213.
      id: "214_application_signals",
      sql: `
        CREATE TABLE IF NOT EXISTS application_signals (
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id        TEXT NOT NULL,
          signals_json  TEXT NOT NULL,
          score         INTEGER,
          recorded_at   INTEGER NOT NULL,
          PRIMARY KEY (user_id, job_id)
        );
      `,
    },
    {
      // ⭐ D143 (owner 11-02) · THE NAVIGATOR. One row per user: their own aim (a role's slug; NULL = follow draft's
      // recommendation), the route as last shown (the skills in order, what they had at the start) and the re-routing
      // changes with their reasons. Written by services/navigator.js. Merge plan keepInto. After 214.
      id: "215_navigator",
      sql: `
        CREATE TABLE IF NOT EXISTS navigator_routes (
          user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          aim_slug      TEXT,
          aim_set_by    TEXT,
          aim_at        INTEGER,
          route_json    TEXT,
          route_at      INTEGER,
          changes_json  TEXT NOT NULL DEFAULT '[]'
        );
      `,
    },
    {
      // ⭐ D138 (owner 11-02) · WARM PATHS. The user's OWN contacts: their LinkedIn connections export, or an alumni list
      // they add (school). Private to the user, deletable (DELETE /api/warm-paths), cascading with the account; never
      // shown to anyone else, never used to contact anyone. company_key = shared/companyIdentity.js companyNameKey, so a
      // posting's company finds its people. services/warmPaths.js. Merge plan move. After 215.
      id: "216_warm_contacts",
      sql: `
        CREATE TABLE IF NOT EXISTS warm_contacts (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          source        TEXT NOT NULL,
          school        TEXT,
          name          TEXT NOT NULL,
          company       TEXT NOT NULL,
          company_key   TEXT NOT NULL,
          position      TEXT,
          url           TEXT,
          email         TEXT,
          connected_on  INTEGER,
          imported_at   INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_warm_contacts_company ON warm_contacts(user_id, company_key);
      `,
    },
    {
      // ⭐ D142 (owner 11-02) · READINESS — CHECK. readiness_questions: the bank, per skill and concept, difficulty 1–3,
      // seconds per question; ⛔ status 'draft' until a person reviews it ('live'), so a wrong answer key never reaches a
      // user. readiness_checks: one adaptive check (mode timed / extended / untimed; the question being asked and when
      // the SERVER served it — the timer is the server's). readiness_answers: each answer, right or not, in time or not.
      // services/readiness.js. Merge plan move (checks, answers). After 216.
      id: "217_readiness",
      sql: `
        CREATE TABLE IF NOT EXISTS readiness_questions (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          skill         TEXT NOT NULL,
          skill_key     TEXT NOT NULL,
          concept       TEXT NOT NULL,
          difficulty    INTEGER NOT NULL,
          prompt        TEXT NOT NULL,
          options_json  TEXT NOT NULL,
          answer        INTEGER NOT NULL,
          explanation   TEXT,
          seconds       INTEGER NOT NULL DEFAULT 20,
          status        TEXT NOT NULL DEFAULT 'draft',
          written_by    TEXT NOT NULL,
          reviewed_by   TEXT,
          reviewed_at   INTEGER,
          created_at    INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_readiness_questions_skill ON readiness_questions(skill_key, status, difficulty);
        CREATE TABLE IF NOT EXISTS readiness_checks (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          skill_key     TEXT NOT NULL,
          mode          TEXT NOT NULL,
          current_q     INTEGER,
          served_at     INTEGER,
          started_at    INTEGER NOT NULL,
          finished_at   INTEGER,
          summary_json  TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_readiness_checks_user ON readiness_checks(user_id, skill_key);
        CREATE TABLE IF NOT EXISTS readiness_answers (
          check_id      INTEGER NOT NULL REFERENCES readiness_checks(id) ON DELETE CASCADE,
          question_id   INTEGER NOT NULL,
          chosen        INTEGER,
          correct       INTEGER NOT NULL,
          in_time       INTEGER NOT NULL,
          ms            INTEGER NOT NULL,
          answered_at   INTEGER NOT NULL,
          PRIMARY KEY (check_id, question_id)
        );
      `,
    },
    {
      // ⭐ D150 T01 (owner 11-03) · THE QUESTION BANK — one reviewed bank used by the audit, Check, Play, Learn, Defend and the
      // company guides (services/learn/learnQuestions.js, ONE reader). learn_questions: the item (role, level, type
      // scenario | recall | explain, a stem, choices, the correct one and a WHY for every choice, the skills and Learn
      // pieces it evidences); ⛔ status 'draft' until a person approves it in Admin → Learn → Questions ('live'), 'retired'
      // after; a re-import never resets status or stats. learn_question_answers: each answer (the choice, the time) — the
      // stats and T02's flags read them; user_id is NULL for the public audit (no sign-in). Merge plan: move. After 217.
      id: "218_learn_questions",
      sql: `
        CREATE TABLE IF NOT EXISTS learn_questions (
          id             TEXT PRIMARY KEY,
          role           TEXT,
          level          TEXT,
          type           TEXT NOT NULL,
          skills_json    TEXT NOT NULL DEFAULT '[]',
          pieces_json    TEXT NOT NULL DEFAULT '[]',
          families_json  TEXT NOT NULL DEFAULT '[]',
          stem           TEXT NOT NULL,
          choices_json   TEXT NOT NULL,
          correct        INTEGER NOT NULL,
          why_json       TEXT NOT NULL,
          source         TEXT,
          status         TEXT NOT NULL DEFAULT 'draft',
          version        INTEGER NOT NULL DEFAULT 1,
          content_hash   TEXT NOT NULL,
          imported_from  TEXT,
          reviewed_by    TEXT,
          reviewed_at    INTEGER,
          created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_learn_questions_pick ON learn_questions(status, role, level, type);
        CREATE TABLE IF NOT EXISTS learn_question_answers (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          question_id    TEXT NOT NULL REFERENCES learn_questions(id) ON DELETE CASCADE,
          user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
          surface        TEXT NOT NULL,
          chosen         INTEGER NOT NULL,
          correct        INTEGER NOT NULL,
          ms             INTEGER,
          answered_at    INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_learn_question_answers_q ON learn_question_answers(question_id);
      `,
    },
    {
      // D151 / A123 (2) (44r, 11-04): THE DESCRIPTION PASS'S STALE SCAN BECOMES AN INDEX READ. A changed description now
      // clears its description_basis here, so services/jobs/descriptionText.js finds stale rows by the basis alone
      // (NULL, or another normaliser version's prefix) instead of hashing every description on the board twice a pass
      // (18.6 s of blocked event loop at 84k postings, on every boot and every 10 minutes). Schema only (D151 Rule 1:
      // no data step in a migration); rows changed before this trigger existed are caught by a one-time sliced sweep.
      // (The cleanup's scraped_at index is built by the boot warm-up, not here: 29 s on the 82k copy, so not before listen.)
      id: "219_boot_bounded_scans",
      sql: `
        CREATE TRIGGER IF NOT EXISTS d151_description_basis_reset AFTER UPDATE OF description ON scraped_jobs
          WHEN NEW.description IS NOT OLD.description AND NEW.description_basis IS NOT NULL
        BEGIN
          UPDATE scraped_jobs SET description_basis = NULL WHERE rowid = NEW.rowid;
        END;
      `,
    },
    {
      // D152 (3) (11-05): PICKS PER DAY — how many cards the Daily Deck deals, the person's own choice (Customise → Daily
      // Deck; shared/deckGeometry.js DECK_SIZES). NULL = never chosen = the standard 10. Schema only (D151 Rule 1).
      id: "220_users_deck_size",
      sql: `
        ALTER TABLE users ADD COLUMN deck_size INTEGER;
      `,
    },
    {
      // D162 G3 + G4 (11-05): THE MODEL GATEWAY. usage_events.task = the model task a call served (shared/modelTasks.js)
      // and .route = how the gateway routed it (default · cohort · shadow · fallback · tools-service); NULL on older rows,
      // which the telemetry attributes by purpose. model_eval_records = one measured evaluation run per task × provider ×
      // model, its verdict computed by the pass rule (services/modelEvals.js) — the gate a model must pass before it
      // serves users on a task. The route switch itself needs no table: app_settings + admin_audit_log (who / when / why).
      // Schema only (D151 Rule 1): two O(1) column adds and a new, empty table — no index on usage_events.
      id: "221_model_gateway",
      sql: `
        ALTER TABLE usage_events ADD COLUMN task TEXT;
        ALTER TABLE usage_events ADD COLUMN route TEXT;
        CREATE TABLE IF NOT EXISTS model_eval_records (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          task             TEXT    NOT NULL,
          provider         TEXT    NOT NULL,
          model            TEXT    NOT NULL,
          eval_set         TEXT    NOT NULL,
          eval_set_version INTEGER NOT NULL,
          passed           INTEGER NOT NULL,
          metrics_json     TEXT    NOT NULL,
          baseline_json    TEXT,
          reasons_json     TEXT    NOT NULL,
          actor            TEXT,
          reason           TEXT,
          at               INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_model_eval_records_lookup
          ON model_eval_records(task, provider, model, at);
      `,
    },
    {
      // D165 (3) (11-06): A SAVED SALARY ANSWER IS SCOPED PER ROLE + LOCATION (D165 R2: "scoped: per role / location
      // for salary, global for eligibility"). user_profile.custom_answer_scoped = a JSON array of
      // { question, answer, kind, roleKey, locationKey, savedAt } (services/scopedAnswers.js); the fill picks the most
      // specific entry whose scope matches the job. NULL = none saved. Eligibility and every other answer stay in
      // custom_answers (global). A column on user_profile, not a new user table, so the account-merge plan and the
      // profile row's lifecycle already cover it. Schema only (D151 Rule 1): one O(1) column add.
      id: "222_saved_answer_scopes",
      sql: `
        ALTER TABLE user_profile ADD COLUMN custom_answer_scoped TEXT;
      `,
    },
    {
      // ⭐ D169 (owner 11-06, approved, revisable) · YOUR SKILLS IN ATLAS — a skill is proven before it goes into a résumé.
      // skill_proofs: what proved a person's skill (a passed quick check → 'checked'; a proof link, D109's validator →
      // 'built'); the gate (services/yourSkills.js resumeClaims) reads it. skill_quick_checks: one quick check — 3–5 items
      // of D150's bank, the item being asked and when the SERVER served it (D142's clock), the answers, passed or not.
      // atlas_skill_holds: a skill a person typed that the Atlas has no published node for — held for the curator, never
      // invented as a node. Schema only (D151 Rule 1). Merge plan: move. Export: all three. After 222.
      id: "223_your_skills",
      sql: `
        CREATE TABLE IF NOT EXISTS skill_proofs (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          skill_key     TEXT NOT NULL,
          skill         TEXT NOT NULL,
          state         TEXT NOT NULL,
          via           TEXT NOT NULL,
          url           TEXT,
          label         TEXT,
          kind          TEXT,
          check_id      INTEGER,
          created_at    INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_skill_proofs_user ON skill_proofs(user_id, skill_key);
        CREATE TABLE IF NOT EXISTS skill_quick_checks (
          id                 INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          skill_key          TEXT NOT NULL,
          skill              TEXT NOT NULL,
          slug               TEXT NOT NULL,
          mode               TEXT NOT NULL,
          question_ids_json  TEXT NOT NULL,
          position           INTEGER NOT NULL DEFAULT 0,
          served_at          INTEGER,
          answers_json       TEXT NOT NULL DEFAULT '[]',
          started_at         INTEGER NOT NULL,
          finished_at        INTEGER,
          passed             INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_skill_quick_checks_user ON skill_quick_checks(user_id, skill_key);
        CREATE TABLE IF NOT EXISTS atlas_skill_holds (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          term          TEXT NOT NULL,
          name          TEXT NOT NULL,
          held_at       INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_atlas_skill_holds_term ON atlas_skill_holds(term);
      `,
    },
    {
      // ⛔ D171 FIX 1 + FIX 2 (owner 11-06: "the prophetic job run took place, which i suppose the agent triggered" ·
      // "theres also an unknown run at 6am utc"): EVERY RUN AND EVERY MODEL CALL SAYS WHO STARTED IT, AND WHICH KEY PAID.
      // apply_runs.started_by = user · scheduler · admin · agent · test · system (shared/startedBy.js) and
      // .started_by_ref = the actor (user:3, admin:adm_…, a script's name). usage_events.started_by = the same kinds, from
      // the request / the run / the scheduler that made the call (services/startedByContext.js); usage_events.key_label =
      // the key that paid — draft's ANTHROPIC_KEY_LABEL ("draft-prod", "local-dev"), or the tools service's for the
      // résumé generations it makes, so Admin → System → Model usage separates local-dev and production spend.
      // users.test_account = 1 for an account made for checks: in production an agent- or test-started run is refused on
      // any other account (FIX 1's rule). NULL on every older row = "not recorded". Schema only (D151 Rule 1): five O(1)
      // column adds, no index, no backfill.
      id: "224_started_by_and_key_label",
      sql: `
        ALTER TABLE apply_runs ADD COLUMN started_by TEXT;
        ALTER TABLE apply_runs ADD COLUMN started_by_ref TEXT;
        ALTER TABLE usage_events ADD COLUMN started_by TEXT;
        ALTER TABLE usage_events ADD COLUMN key_label TEXT;
        ALTER TABLE users ADD COLUMN test_account INTEGER;
      `,
    },
    {
      // ⭐ D171 FIX 3 (owner 11-06: he could not open the job from Home to compare the JD with the résumé): THE JOB
      // DESCRIPTION, AS IT READ WHEN THE APPLICATION WAS MADE. 129 snapshotted the posting's title, company, URL and
      // location onto the run-job; the description stayed on scraped_jobs, where a re-crawl rewrites it and a closed
      // posting stops being the one applied to. It is now copied at the same moment, in the same transaction
      // (routes/apply.js), and served by routes/applicationPosting.js. NULL: made before this — the reader falls back to
      // the live posting and says so. No backfill: today's text is not what was applied to. Merge plan: apply_run_jobs
      // moves already. After 224.
      id: "225_posting_description_snapshot",
      sql: `
        ALTER TABLE apply_run_jobs ADD COLUMN posting_description TEXT;
      `,
    },
    {
      // ⭐ D172 (3) · POINTS ONLY FROM PROOF (atlas-redesign-sketch.html → Your run): one row per piece of proof — an
      // explanation in the person's own words, a build, a skill checked (a passed quick check) or built (a proof link) —
      // keyed (user, kind, ref), so the same proof can never pay twice. Filled from the proof records themselves
      // (services/atlas/points.js syncPoints), so it is retroactive and cannot drift from them; a week's points (the
      // league, later) read it by earned_at. Merge plan: keepInto (a clash keeps INTO's row). After 225.
      id: "226_proof_points",
      sql: `
        CREATE TABLE IF NOT EXISTS proof_points (
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind       TEXT NOT NULL,
          ref        TEXT NOT NULL,
          points     INTEGER NOT NULL,
          earned_at  INTEGER NOT NULL,
          PRIMARY KEY (user_id, kind, ref)
        );
        CREATE INDEX IF NOT EXISTS idx_proof_points_earned ON proof_points(earned_at, user_id);
      `,
    },
    {
      // ⭐ D178-4 · THE PROOF PAGE SHOWS WHAT WAS PROVEN IN ATLAS — only when the person says so. The public page (D109 P3,
      // /p/<handle>) is opt-in already, but people who turned it on agreed to their projects, not their learning: a
      // second switch, OFF for every existing and new page. When on, the page adds the modules finished, the skills
      // passed in a quick check or backed by a proof link, and the builds — each with its date
      // (services/atlas/points.js learningProof). Only ADDS a column. After 226.
      id: "227_proof_page_learning",
      sql: `
        ALTER TABLE proof_pages ADD COLUMN show_learning INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      // ⭐ D151 Rule 4 (measured 11-08 on the 100k fixture: the board's COUNT and id page show "SCAN jc" inside a correlated
      // subquery per posting) · job_captures had no index for (user_id, job_id) — the board's "my captures" EXISTS, the +
      // view, the capture lookups in autoCapture / captureOutcome all filter on exactly that. One index; only ADDS. After 227.
      id: "228_job_captures_user_job",
      sql: `
        CREATE INDEX IF NOT EXISTS idx_job_captures_user_job ON job_captures(user_id, job_id);
      `,
    },
    {
      // ⭐ D151 Rule 4 (measured 11-08 on the 100k fixture): the board's "being matched" read — the newest postings not yet
      // scored for the person, ORDER BY COALESCE(posted_at, discovered_at) DESC LIMIT 2000 — sorted the whole active board
      // to pick 2,000 (4.9 s on a copy; SCAN sj). A partial index on that recency, active postings only, lets it walk
      // newest-first and stop (160 ms). The expression is the board's own, character for character. Only ADDS. After 228.
      id: "229_scraped_jobs_active_recency",
      sql: `
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_active_recency ON scraped_jobs(COALESCE(posted_at, discovered_at) DESC) WHERE is_active = 1;
      `,
    },
    {
      // ⭐ D151 (45l): atlas_changes moves on every write to atlas_nodes and skill_synonyms (D118 P2 (b)) but NOT on
      // atlas_edges — so nothing keyed on it could keep the `requires` map (Your map's branches rebuilt it from every
      // edge on every call: 3.0 s of main-thread time in 45k's 20-user profile). The same three triggers on atlas_edges,
      // so the user-independent Atlas pieces can be kept until the Atlas really changes. Only ADDS. After 229.
      id: "230_atlas_edges_changes",
      sql: `
        CREATE TRIGGER IF NOT EXISTS atlas_edges_changed_ins AFTER INSERT ON atlas_edges BEGIN UPDATE atlas_changes SET n = n + 1 WHERE id = 1; END;
        CREATE TRIGGER IF NOT EXISTS atlas_edges_changed_upd AFTER UPDATE ON atlas_edges BEGIN UPDATE atlas_changes SET n = n + 1 WHERE id = 1; END;
        CREATE TRIGGER IF NOT EXISTS atlas_edges_changed_del AFTER DELETE ON atlas_edges BEGIN UPDATE atlas_changes SET n = n + 1 WHERE id = 1; END;
      `,
    },
    {
      // ⭐ D179 P4a (45l): ONE COMPANY = ONE RECORD. A company was a free-text scraped_jobs.company and three normalisers
      // each decided "the same company" on their own. companies = one row per employer (slug for /companies/<slug>, its
      // own site, a parent link set only by an admin — subsidiaries linked, never merged); company_aliases = every key
      // that resolves to it with its evidence (ats:<provider>:<tenant> · domain:<site> · name:<normalised>); job_company
      // = posting → company in its OWN small table (an UPDATE on scraped_jobs rewrites the whole posting row — A132);
      // company_review = the unsure pairs for Admin, never merged automatically. services/companies/companyRecords.js.
      // Only ADDS. After 230.
      id: "231_company_records",
      sql: `
        CREATE TABLE IF NOT EXISTS companies (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          slug        TEXT NOT NULL UNIQUE,
          name        TEXT NOT NULL,
          domain      TEXT,
          parent_id   INTEGER REFERENCES companies(id) ON DELETE SET NULL,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
        CREATE TABLE IF NOT EXISTS company_aliases (
          alias_key   TEXT PRIMARY KEY,
          company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          evidence    TEXT NOT NULL,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_company_aliases_company ON company_aliases(company_id);
        CREATE TABLE IF NOT EXISTS job_company (
          job_id      TEXT PRIMARY KEY,
          company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          linked_at   INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_job_company_company ON job_company(company_id);
        CREATE TABLE IF NOT EXISTS company_review (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          a_id        INTEGER NOT NULL,
          b_id        INTEGER NOT NULL,
          reason      TEXT,
          status      TEXT NOT NULL DEFAULT 'open',
          decision    TEXT,
          decided_by  INTEGER,
          decided_at  INTEGER,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(a_id, b_id)
        );
        CREATE INDEX IF NOT EXISTS idx_company_review_open ON company_review(status, created_at);
      `,
    },
    {
      // ⭐ D179 P5a (45l): TECHNOGRAPHICS FROM THE COMPANY'S OWN POSTINGS. job_tech = the technologies each posting names
      // (shared/techVocabulary.js — technologies only, with aliases), read once per content (job_tech_scan holds the
      // content hash it was read at); company_tech = each company record's stack (P4a) with its evidence — postings,
      // first / last seen, teams — rebuilt from those small rows, never from the descriptions again. The old
      // company_technographics (by name, soft skills mixed in, no writer) stays until P4b moves its readers. Only ADDS.
      id: "232_company_tech",
      sql: `
        CREATE TABLE IF NOT EXISTS job_tech (
          job_id  TEXT NOT NULL,
          tech    TEXT NOT NULL,
          PRIMARY KEY (job_id, tech)
        ) WITHOUT ROWID;
        CREATE INDEX IF NOT EXISTS idx_job_tech_tech ON job_tech(tech);
        CREATE TABLE IF NOT EXISTS job_tech_scan (
          job_id        TEXT PRIMARY KEY,
          content_hash  TEXT,
          scanned_at    INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS company_tech (
          company_id   INTEGER NOT NULL,
          tech         TEXT NOT NULL,
          grp          TEXT NOT NULL,
          postings     INTEGER NOT NULL,
          first_seen   INTEGER,
          last_seen    INTEGER,
          teams_json   TEXT,
          computed_at  INTEGER NOT NULL,
          PRIMARY KEY (company_id, tech)
        );
        CREATE INDEX IF NOT EXISTS idx_company_tech_tech ON company_tech(tech, postings);
      `,
    },
    {
      // ⭐ D179 P2 (45l): CATEGORY → SUBCATEGORY per posting, from the approved taxonomy (content/taxonomy/roles-v1.json;
      // services/jobs/taxonomyClassify.js). Its own small table (no scraped_jobs row rewrites — A132), with the taxonomy
      // version each answer was read at, so a new version re-reads and an unchanged one never does. Only ADDS.
      id: "233_job_taxonomy",
      sql: `
        CREATE TABLE IF NOT EXISTS job_taxonomy (
          job_id         TEXT PRIMARY KEY,
          category       TEXT,
          subcategory    TEXT,
          confidence     REAL,
          reason         TEXT,
          version        TEXT NOT NULL,
          classified_at  INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_job_taxonomy_sub ON job_taxonomy(subcategory);
        CREATE INDEX IF NOT EXISTS idx_job_taxonomy_cat ON job_taxonomy(category);
      `,
    },
    {
      // ⛔ A140 (1) (45l): the trial accounts cleaned of the sample résumé's details ONCE — services/sampleProfileStrip.js
      // records each account here, so a boot never re-reads (and overwrites) a profile the person has edited since. Only ADDS.
      id: "234_a140_trial_cleaned",
      sql: `
        CREATE TABLE IF NOT EXISTS a140_trial_cleaned (
          user_id     INTEGER PRIMARY KEY,
          cleaned_at  INTEGER NOT NULL
        );
      `,
    },
    {
      // ⭐ D179 P4b (45l): a company record's public facts (Wikidata, CC0, matched by the company's OWN website) — the
      // company page's "About" is written from these in draft's own words (services/companies/companyFacts.js). status:
      // ok · none (no item has that site) · failed; re-read after 90 days. Only ADDS.
      id: "235_company_facts",
      sql: `
        CREATE TABLE IF NOT EXISTS company_facts (
          company_id   INTEGER PRIMARY KEY,
          wikidata_id  TEXT,
          industry     TEXT,
          hq           TEXT,
          founded      INTEGER,
          employees    INTEGER,
          status       TEXT NOT NULL,
          fetched_at   INTEGER NOT NULL
        );
      `,
    },
    {
      // ⭐ D179 P5b (45l): a company record's public GitHub organisation — matched only when the organisation's own site names
      // the company's (services/companies/companyGithub.js) — and its repositories' languages. status ok / none / failed;
      // re-read after 30 days. Only ADDS.
      id: "236_company_github",
      sql: `
        CREATE TABLE IF NOT EXISTS company_github (
          company_id      INTEGER PRIMARY KEY,
          org             TEXT,
          languages_json  TEXT,
          status          TEXT NOT NULL,
          fetched_at      INTEGER NOT NULL
        );
      `,
    },
    {
      // ⭐ D179 P4b / D159 T1 (45l): Follow a company — one row per person and company record (D179 P4a). The alerts that
      // follow from it (new fitting postings at companies you follow) are D159's, not built here. Only ADDS.
      id: "237_company_follows",
      sql: `
        CREATE TABLE IF NOT EXISTS company_follows (
          user_id     INTEGER NOT NULL,
          company_id  INTEGER NOT NULL,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, company_id)
        );
        CREATE INDEX IF NOT EXISTS idx_company_follows_company ON company_follows(company_id);
      `,
    },
    {
      // ⭐ D179 P5c (45l): light signals from a company's own homepage (headers, a framework's or host's own markers) —
      // shown labelled as such, never mixed into the postings' evidence (services/companies/companyWebSignals.js). Only ADDS.
      id: "238_company_web_signals",
      sql: `
        CREATE TABLE IF NOT EXISTS company_web_signals (
          company_id    INTEGER PRIMARY KEY,
          signals_json  TEXT,
          status        TEXT NOT NULL,
          fetched_at    INTEGER NOT NULL
        );
      `,
    },
    {
      // ⭐ D150 T05–T07 (45l): the 3-minute audit's anonymous sessions — a random token is the only key (no account, nothing
      // personal); the six item ids, the answers given; claimed_by / claimed_at once a signed-in person keeps it (T07, once).
      // Unclaimed sessions are deleted after 30 days (services/audit/auditSession.js purgeUnclaimed). Only ADDS.
      id: "239_audit_sessions",
      sql: `
        CREATE TABLE IF NOT EXISTS audit_sessions (
          token          TEXT PRIMARY KEY,
          role_slug      TEXT NOT NULL,
          bank_role      TEXT NOT NULL,
          level          TEXT,
          item_ids_json  TEXT NOT NULL,
          answers_json   TEXT NOT NULL DEFAULT '[]',
          created_at     INTEGER NOT NULL,
          claimed_by     INTEGER,
          claimed_at     INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_audit_sessions_created ON audit_sessions(claimed_at, created_at);
      `,
    },
    {
      // ⭐ D154 P1 (45l): the daily question — one per person per (their local) day, the item, WHY it was picked (review ·
      // audit · aim · any), and the answer once given (services/learn/dailyQuestion.js). Merge plan: keepInto. Only ADDS.
      id: "240_daily_questions",
      sql: `
        CREATE TABLE IF NOT EXISTS daily_questions (
          user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          day          TEXT NOT NULL,
          question_id  TEXT NOT NULL,
          reason       TEXT NOT NULL,
          chosen       INTEGER,
          correct      INTEGER,
          ms           INTEGER,
          answered_at  INTEGER,
          created_at   INTEGER NOT NULL,
          PRIMARY KEY (user_id, day)
        );
      `,
    },
    {
      // ⭐ D179 P6 (owner 11-08: "create the 134 roles as drafts"): each taxonomy subcategory ↔ its Atlas role node (a draft
      // for the Atlas desk, or an existing role of that name) — services/atlas/taxonomyRoleNodes.js, seeded on boot. Only ADDS.
      id: "241_atlas_taxonomy_roles",
      sql: `
        CREATE TABLE IF NOT EXISTS atlas_taxonomy_roles (
          subcategory  TEXT PRIMARY KEY,
          node_id      INTEGER NOT NULL REFERENCES atlas_nodes(id) ON DELETE CASCADE,
          category     TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_atlas_taxonomy_roles_node ON atlas_taxonomy_roles(node_id);
      `,
    },
    {
      // ⭐ D154 P2 (45l): a match / order daily answer keeps its full response (the pairs / the order given), so the
      // result can be shown again per pair / position on a later visit the same day.
      id: "242_daily_question_response",
      sql: `
        ALTER TABLE daily_questions ADD COLUMN response_json TEXT;
      `,
    },
    {
      // ⭐ D183 P1 (owner 11-08, TOP PRIORITY): Profile = your page. Who can see it (page level, DEFAULT only_me; each
      // section's own eye in sections_json, never wider than the page), search engines (off), Open to work / referrals,
      // the headline; and the achievements added by hand. services/profilePage.js. Only ADDS.
      id: "243_profile_page",
      sql: `
        CREATE TABLE IF NOT EXISTS profile_page (
          user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          page_level    TEXT NOT NULL DEFAULT 'only_me' CHECK (page_level IN ('only_me', 'connections', 'public')),
          sections_json TEXT NOT NULL DEFAULT '{}',
          searchable    INTEGER NOT NULL DEFAULT 0,
          open_to_work  INTEGER NOT NULL DEFAULT 0,
          referrals     INTEGER NOT NULL DEFAULT 0,
          headline      TEXT,
          updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS profile_achievements (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title      TEXT NOT NULL,
          detail     TEXT,
          year       INTEGER,
          position   INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_profile_achievements_user ON profile_achievements(user_id, position);
      `,
    },
    {
      // ⭐ D183 P2 (owner 11-08): replacing the résumé re-fills every section, says what changed, and can be undone for
      // 30 days. A hand-edited summary / link is marked so a replace keeps it (the list sections already carry `source`);
      // each replace keeps a snapshot of what it changed (services/profileReplace.js). Only ADDS.
      id: "244_profile_replacements",
      sql: `
        ALTER TABLE profile_sections ADD COLUMN summary_source TEXT;
        ALTER TABLE profile_links ADD COLUMN source TEXT;
        CREATE TABLE IF NOT EXISTS profile_replacements (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          profile_id    INTEGER,
          status        TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'kept', 'undone')),
          snapshot_json TEXT NOT NULL,
          changes_json  TEXT NOT NULL,
          created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
          settled_at    INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_profile_replacements_user ON profile_replacements(user_id, created_at DESC);
      `,
    },
    {
      // ⭐ D183 P3 (owner 11-08): the public page /in/<handle>. (1) Report this profile → the moderation queue (built with
      // this, as D183 says — D180 will read the same table). (2) A person who had turned the D109 proof page ON keeps
      // that earlier yes for those two things only: the page starts PUBLIC with projects and skills showing and every
      // other section at Only you. INSERT OR IGNORE — a person who already set their page is never changed.
      id: "245_profile_public_page",
      sql: `
        CREATE TABLE IF NOT EXISTS profile_reports (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          reported_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          handle           TEXT NOT NULL,
          reason           TEXT NOT NULL,
          details          TEXT,
          reporter_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          reporter_hash    TEXT,
          status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'actioned')),
          created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
          resolved_at      INTEGER,
          resolved_note    TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_profile_reports_status ON profile_reports(status, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_profile_reports_hash ON profile_reports(reporter_hash, created_at);
        INSERT OR IGNORE INTO profile_page (user_id, page_level, sections_json)
          SELECT user_id, 'public', '{"about":"only_me","experience":"only_me","fit":"only_me","achievements":"only_me","education":"only_me","links":"only_me"}'
          FROM proof_pages WHERE enabled = 1;
      `,
    },
    {
      // ⭐ D154 P1 (45m): the daily question's reminder — the hour the person chose (their local hour, with the browser's
      // offset from UTC when they chose it) and the last local day it was sent. No row = no time chosen; the switches
      // themselves are notification_prefs' daily_question (OFF by default). Only ADDS.
      id: "246_daily_reminders",
      sql: `
        CREATE TABLE IF NOT EXISTS daily_reminders (
          user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          hour           INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
          tz_offset_min  INTEGER NOT NULL DEFAULT 0,
          last_sent_day  TEXT,
          updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      // ⭐ D162 G6 (45n) · where a stored résumé's words came from — the model's source tag, so a Claude-written (or any
      // model's) output can never be taken for training data (D160 rule 1, services/trainingData.js). JSON
      // { provider, model, task, claude } or 'byo_model' / 'human'; NULL = written before this column. Only ADDS.
      id: "247_model_source",
      sql: `
        ALTER TABLE resume_versions ADD COLUMN model_source TEXT;
        ALTER TABLE resumes ADD COLUMN model_source TEXT;
      `,
    },
    {
      // ⭐ D150 T09 (45n) · "Your market this week" — one row per D127 field and ISO week (services/market/marketWeek.js):
      // the numbers as computed by method `method_version`, each with its n; never a posting named. Only ADDS.
      id: "248_market_weeks",
      sql: `
        CREATE TABLE IF NOT EXISTS market_weeks (
          field          TEXT NOT NULL,
          iso_week       TEXT NOT NULL,
          week_start     INTEGER NOT NULL,
          metrics_json   TEXT NOT NULL,
          method_version INTEGER NOT NULL,
          computed_at    INTEGER NOT NULL,
          PRIMARY KEY (field, iso_week, method_version)
        );
      `,
    },
    {
      // ⭐ D150 T12 (45n) · company guides from debriefs people CHOSE to share (services/interview/companyGuides.js):
      // a debrief gains its company (by its application's job), level, topics and the explicit pool_consent (0 by
      // default; the form does not offer it until the privacy wording and counsel's answers are in); company_guides
      // holds a guide per company + level only once >= 3 distinct people shared (k-anonymity), never a name or a date
      // narrower than the month. Only ADDS.
      id: "249_company_guides",
      sql: `
        ALTER TABLE interview_debriefs ADD COLUMN company_key TEXT;
        ALTER TABLE interview_debriefs ADD COLUMN level TEXT;
        ALTER TABLE interview_debriefs ADD COLUMN topics_json TEXT NOT NULL DEFAULT '[]';
        ALTER TABLE interview_debriefs ADD COLUMN pool_consent INTEGER NOT NULL DEFAULT 0;
        CREATE INDEX IF NOT EXISTS idx_interview_debriefs_pool ON interview_debriefs(company_key, pool_consent);
        CREATE TABLE IF NOT EXISTS company_guides (
          company_key    TEXT NOT NULL,
          level          TEXT NOT NULL,
          guide_json     TEXT NOT NULL,
          contributors   INTEGER NOT NULL,
          updated_month  TEXT NOT NULL,
          updated_at     INTEGER NOT NULL,
          PRIMARY KEY (company_key, level)
        );
      `,
    },
    {
      // ⭐ 45n (owner 11-08) · people in the one search — only PUBLIC pages, only what that public page shows (name,
      // headline, workplace, school, handle; services/peopleSearch.js). A page that stops being public is dropped. Only ADDS.
      id: "250_people_index",
      sql: `
        CREATE TABLE IF NOT EXISTS people_index (
          user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          name       TEXT NOT NULL,
          name_key   TEXT NOT NULL,
          headline   TEXT,
          workplace  TEXT,
          school     TEXT,
          handle     TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_people_index_name ON people_index(name_key);
      `,
    },
    {
      // ⭐ A155 (45o, the D178 picks: "the person can also choose weekdays only") · Atlas's own per-person choices. One row
      // per person who changed one; no row = the defaults (weekdays_only 0: every day counts, one rest day a week). Only ADDS.
      id: "251_atlas_prefs",
      sql: `
        CREATE TABLE IF NOT EXISTS atlas_prefs (
          user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          weekdays_only INTEGER NOT NULL DEFAULT 0 CHECK (weekdays_only IN (0, 1)),
          updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      // ⭐ D180 P1 (45o, owner 11-08: "build it now; counsel reviews before it ships") · CONNECTIONS — mutual (request →
      // accept), one row per pair (low_id < high_id), and blocks. Behind the network switch (app_settings network_enabled,
      // OFF by default): nothing here is reachable until the owner turns it on. ON DELETE CASCADE on both people — a
      // deleted account takes its connections and blocks with it (D180: "account deletion removes their content"). Only ADDS.
      id: "252_network_connections",
      sql: `
        CREATE TABLE IF NOT EXISTS network_connections (
          low_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          high_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          requester_id  INTEGER NOT NULL,
          status        TEXT    NOT NULL CHECK (status IN ('pending', 'accepted')),
          note          TEXT,
          created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
          responded_at  INTEGER,
          PRIMARY KEY (low_id, high_id),
          CHECK (low_id < high_id)
        );
        CREATE INDEX IF NOT EXISTS idx_network_connections_high ON network_connections(high_id);
        CREATE TABLE IF NOT EXISTS network_blocks (
          blocker_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          blocked_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (blocker_id, blocked_id)
        );
      `,
    },
    {
      // ⭐ D180 P2 (45o) · 1:1 MESSAGES, A JOB AS A CARD, REQUESTS, MUTE, REPORT — the safety pieces WITH messages, not after
      // (the spec). Behind the network switch (OFF). A body is SEALED at rest (secretBox, AES-256-GCM: enc / iv / tag); a
      // thread between two people who aren't connected is a REQUEST until the one asked accepts. Reports keep only a hash
      // of the reporter (as D183's profile reports). ON DELETE CASCADE from the people — deleting an account removes its
      // threads and messages (D180: "account deletion removes their content"). Only ADDS.
      id: "253_network_messages",
      sql: `
        CREATE TABLE IF NOT EXISTS network_threads (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          low_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          high_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status        TEXT    NOT NULL CHECK (status IN ('open', 'request')),
          requester_id  INTEGER NOT NULL,
          created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
          last_at       INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE (low_id, high_id),
          CHECK (low_id < high_id)
        );
        CREATE INDEX IF NOT EXISTS idx_network_threads_high ON network_threads(high_id);
        CREATE TABLE IF NOT EXISTS network_messages (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          thread_id      INTEGER NOT NULL REFERENCES network_threads(id) ON DELETE CASCADE,
          sender_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind           TEXT    NOT NULL CHECK (kind IN ('text', 'job')),
          body_enc       TEXT,
          body_iv        TEXT,
          body_tag       TEXT,
          job_id         INTEGER,
          removed        INTEGER NOT NULL DEFAULT 0,
          hidden_sender  INTEGER NOT NULL DEFAULT 0,
          hidden_other   INTEGER NOT NULL DEFAULT 0,
          created_at     INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_network_messages_thread ON network_messages(thread_id, id);
        CREATE TABLE IF NOT EXISTS network_reads (
          thread_id     INTEGER NOT NULL REFERENCES network_threads(id) ON DELETE CASCADE,
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          last_read_id  INTEGER NOT NULL DEFAULT 0,
          muted         INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (thread_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS network_reports (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          reporter_hash     TEXT    NOT NULL,
          reported_user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
          target_kind       TEXT    NOT NULL CHECK (target_kind IN ('message', 'thread', 'profile')),
          target_id         INTEGER,
          reason            TEXT    NOT NULL,
          details           TEXT,
          status            TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
          note              TEXT,
          created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
          resolved_at       INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_network_reports_status ON network_reports(status, created_at);
      `,
    },
    {
      // ⭐ FIRST PRIORITY (A)-1 (45o, owner 11-08: "a run job never opens without its résumé") · WHY a run job has no
      // résumé. Run-job 16 (the 11-07 semi run) ended with none and NO reason: a semi run's generation failure was logged as
      // an event while its row's reason_code was overwritten with 'manual_review'. Written wherever a run job ends without a
      // résumé; the résumé route also derives one for older rows (the generation_failed event, or the hold). Only ADDS.
      id: "254_run_job_resume_missing_reason",
      sql: `
        ALTER TABLE apply_run_jobs ADD COLUMN resume_missing_reason TEXT;
      `,
    },
    {
      // ⭐ FIRST PRIORITY (B)-1 (45o, owner 11-08) · ONE PLACEMENT, ONE SOURCE — the job profile keeps the résumé's placement
      // in D179's taxonomy (category → subcategory, level, one 'also fits', the classifier's confidence); it writes the
      // profile's domain / role_family through roles-v1.json's registryMap. placed_at NULL = never placed; a placed_at with
      // no category = 'we couldn't place you — pick your role'. Only ADDS.
      id: "255_job_profile_placement",
      sql: `
        ALTER TABLE domain_profiles ADD COLUMN placement_category TEXT;
        ALTER TABLE domain_profiles ADD COLUMN placement_subcategory TEXT;
        ALTER TABLE domain_profiles ADD COLUMN placement_level TEXT;
        ALTER TABLE domain_profiles ADD COLUMN placement_also TEXT;
        ALTER TABLE domain_profiles ADD COLUMN placement_confidence REAL;
        ALTER TABLE domain_profiles ADD COLUMN placed_at INTEGER;
      `,
    },
    {
      // ⭐ FIRST PRIORITY (B)-3 (45o, owner 11-08) · APPLY FOR ME NEVER JUMPS FAMILY SILENTLY — when a new résumé moves the
      // job profile's CATEGORY, Apply for me pauses for that profile until the person says Keep or Change back. The role it
      // moved FROM is kept (JSON: domain, role_family, the placement) so Change back can restore it. Only ADDS.
      id: "256_job_profile_apply_pause",
      sql: `
        ALTER TABLE domain_profiles ADD COLUMN apply_paused_at INTEGER;
        ALTER TABLE domain_profiles ADD COLUMN apply_paused_from TEXT;
      `,
    },
    {
      // D185-1 (45q, owner 11-09) · THE APPLICATION-SCHEMA READER — a posting's real application questions, read from the
      // ATS's documented public endpoint (services/jobs/applicationSchema.js), cached per posting for the fill and tailoring.
      // status: ok | unsupported | not_found | error. Only ADDS.
      id: "257_posting_application_schemas",
      sql: `
        CREATE TABLE IF NOT EXISTS posting_application_schemas (
          job_id      TEXT PRIMARY KEY,
          ats         TEXT,
          status      TEXT NOT NULL,
          fields_json TEXT NOT NULL DEFAULT '[]',
          error       TEXT,
          fetched_at  INTEGER NOT NULL
        );
      `,
    },
    {
      // D185-2 (45q, owner 11-09) · NEW-MATCH ALERTS (services/jobs/newMatchAlerts.js). match_alert_settings: the person's
      // choice (digest | instant | off), their local hour, the sweep's cursor and the last digest day. match_alerts: ONE row per
      // (person, posting) alerted — claimed before the message (at most once) and the record Admin reads time-to-alert from.
      // Only ADDS.
      id: "258_match_alerts",
      sql: `
        CREATE TABLE IF NOT EXISTS match_alert_settings (
          user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          mode            TEXT NOT NULL DEFAULT 'digest',
          hour            INTEGER NOT NULL DEFAULT 9,
          tz_offset_min   INTEGER NOT NULL DEFAULT 0,
          cursor_at       INTEGER,
          last_digest_day TEXT,
          updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS match_alerts (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id        TEXT NOT NULL,
          profile_id    INTEGER,
          source        TEXT,
          posted_at     INTEGER,
          discovered_at INTEGER,
          matched       INTEGER,
          of_skills     INTEGER,
          sponsor       INTEGER NOT NULL DEFAULT 0,
          mode          TEXT,
          batch         TEXT,
          alerted_at    INTEGER NOT NULL,
          UNIQUE (user_id, job_id)
        );
        CREATE INDEX IF NOT EXISTS idx_match_alerts_alerted ON match_alerts(alerted_at);
        CREATE INDEX IF NOT EXISTS idx_match_alerts_user ON match_alerts(user_id, alerted_at);
      `,
    },
    {
      // D185-3 (45q, owner 11-09) · THE ATLAS CONTENT BACKLOG (services/atlas/risingSkills.js): one row per (rising skill,
      // subcategory) a person asked to outline — the market signal, the draft outline (steps + the register's sources, each
      // adapt or link-only) and its review. status: draft | accepted | rejected. Never a lesson, never published. Only ADDS.
      id: "259_atlas_backlog",
      sql: `
        CREATE TABLE IF NOT EXISTS atlas_backlog (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          term         TEXT NOT NULL,
          subcategory  TEXT NOT NULL,
          signal_json  TEXT,
          outline_json TEXT,
          status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'accepted', 'rejected')),
          drafted_by   TEXT,
          drafted_at   INTEGER,
          reviewed_by  TEXT,
          reviewed_at  INTEGER,
          UNIQUE (term, subcategory)
        );
      `,
    },
    {
      // D185-7 (45q, owner 11-09) · "How did you hear about us?" → "draft", only when the person agreed (and only for jobs
      // they found on draft — routes/apply.js withHowHeard). NULL / 0 = off: never answered for them by default. Only ADDS.
      id: "260_user_credit_draft",
      sql: `
        ALTER TABLE user_profile ADD COLUMN credit_draft INTEGER;
      `,
    },
    {
      // D151 RULE 2 (45q) · ONE BACKGROUND JOB SYSTEM (services/ops/jobQueue.js): whole-board work leaves the request path
      // and runs as leased, time-budgeted slices with retries and a recorded duration. ONE pending / running job per
      // (kind, key) — the partial unique index is the dedupe. Only ADDS.
      id: "261_bg_jobs",
      sql: `
        CREATE TABLE IF NOT EXISTS bg_jobs (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          kind         TEXT NOT NULL,
          key          TEXT NOT NULL DEFAULT '',
          status       TEXT NOT NULL CHECK (status IN ('pending', 'running', 'done', 'failed')),
          run_after    INTEGER NOT NULL,
          lease_until  INTEGER,
          attempts     INTEGER NOT NULL DEFAULT 0,
          slices       INTEGER NOT NULL DEFAULT 0,
          payload_json TEXT,
          last_error   TEXT,
          duration_ms  INTEGER NOT NULL DEFAULT 0,
          created_at   INTEGER NOT NULL,
          started_at   INTEGER,
          finished_at  INTEGER
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_bg_jobs_one_live ON bg_jobs(kind, key) WHERE status IN ('pending', 'running');
        CREATE INDEX IF NOT EXISTS idx_bg_jobs_due ON bg_jobs(status, run_after);
      `,
    },
    {
      // A158 (45r) · THE OPEN PUBLIC BOARD AS ITS OWN NARROW TABLE. Every whole-board public read (the sitemaps first) filtered
      // scraped_jobs on is_active / duplicate_of / board_category, which sit AFTER description in the row: on production's
      // volume one such scan ran for minutes and, on the main thread, froze the site (11-09). This table holds one small row
      // per OPEN public posting, kept by triggers on every write that can change it; the rows already there are copied in by
      // a paced walk (services/jobs/publicOpenJobs.js), never here. Only ADDS.
      id: "262_public_open_jobs",
      sql: `
        CREATE TABLE IF NOT EXISTS public_open_jobs (
          job_id   TEXT PRIMARY KEY,
          id       INTEGER NOT NULL,
          company  TEXT,
          title    TEXT,
          t        INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_public_open_jobs_id ON public_open_jobs(id);
        CREATE TRIGGER IF NOT EXISTS public_open_ins AFTER INSERT ON scraped_jobs
          WHEN NEW.is_active = 1 AND NEW.duplicate_of IS NULL AND NEW.board_category IS NOT NULL AND NEW.board_category <> 'held'
        BEGIN
          INSERT OR REPLACE INTO public_open_jobs (job_id, id, company, title, t)
            VALUES (NEW.job_id, NEW.id, NEW.company, NEW.title, COALESCE(NEW.updated_at, NEW.discovered_at));
        END;
        CREATE TRIGGER IF NOT EXISTS public_open_upd AFTER UPDATE OF is_active, duplicate_of, board_category, title, company, job_id ON scraped_jobs
        BEGIN
          DELETE FROM public_open_jobs WHERE job_id = OLD.job_id;
          INSERT OR REPLACE INTO public_open_jobs (job_id, id, company, title, t)
            SELECT NEW.job_id, NEW.id, NEW.company, NEW.title, COALESCE(NEW.updated_at, NEW.discovered_at)
             WHERE NEW.is_active = 1 AND NEW.duplicate_of IS NULL AND NEW.board_category IS NOT NULL AND NEW.board_category <> 'held';
        END;
        CREATE TRIGGER IF NOT EXISTS public_open_del AFTER DELETE ON scraped_jobs
        BEGIN
          DELETE FROM public_open_jobs WHERE job_id = OLD.job_id;
        END;
      `,
    },
    {
      // D180 P3 (45r, owner 11-08: "build ... and merge later") · THE FEED, behind the network switch (OFF by default).
      // Posts from connections, CHRONOLOGICAL (no ranking); one reaction (helpful) and comments; proof moments only of the
      // kinds the person turned on (network_share_prefs, every kind OFF until turned on) — an Atlas check passed becomes a
      // post by the trigger below only when `checks` is on. Authors' posts and comments go with their account (CASCADE).
      // network_reports gains 'post' and 'comment' (the table is rebuilt: SQLite can't widen a CHECK in place). Only ADDS
      // otherwise; the report rows are copied as they are.
      id: "263_network_feed",
      sql: `
        CREATE TABLE IF NOT EXISTS network_posts (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          author_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind         TEXT    NOT NULL CHECK (kind IN ('post', 'job', 'proof')),
          body         TEXT,
          link_url     TEXT,
          job_id       INTEGER,
          proof_kind   TEXT,
          proof_label  TEXT,
          created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
          removed_at   INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_network_posts_author ON network_posts(author_id, id);
        CREATE TABLE IF NOT EXISTS network_post_helpful (
          post_id     INTEGER NOT NULL REFERENCES network_posts(id) ON DELETE CASCADE,
          user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (post_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS network_comments (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id     INTEGER NOT NULL REFERENCES network_posts(id) ON DELETE CASCADE,
          author_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          body        TEXT    NOT NULL,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          removed_at  INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_network_comments_post ON network_comments(post_id, id);
        CREATE TABLE IF NOT EXISTS network_share_prefs (
          user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          checks      INTEGER NOT NULL DEFAULT 0,
          new_role    INTEGER NOT NULL DEFAULT 0,
          updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TRIGGER IF NOT EXISTS network_proof_check AFTER INSERT ON skill_proofs
          WHEN NEW.state = 'checked' AND EXISTS (SELECT 1 FROM network_share_prefs p WHERE p.user_id = NEW.user_id AND p.checks = 1)
        BEGIN
          INSERT INTO network_posts (author_id, kind, proof_kind, proof_label) VALUES (NEW.user_id, 'proof', 'check', NEW.skill);
        END;
        CREATE TABLE IF NOT EXISTS network_reports_263 (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          reporter_hash     TEXT    NOT NULL,
          reported_user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
          target_kind       TEXT    NOT NULL CHECK (target_kind IN ('message', 'thread', 'profile', 'post', 'comment')),
          target_id         INTEGER,
          reason            TEXT    NOT NULL,
          details           TEXT,
          status            TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
          note              TEXT,
          created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
          resolved_at       INTEGER
        );
        INSERT INTO network_reports_263 (id, reporter_hash, reported_user_id, target_kind, target_id, reason, details, status, note, created_at, resolved_at)
          SELECT id, reporter_hash, reported_user_id, target_kind, target_id, reason, details, status, note, created_at, resolved_at FROM network_reports;
        DROP TABLE network_reports;
        ALTER TABLE network_reports_263 RENAME TO network_reports;
        CREATE INDEX IF NOT EXISTS idx_network_reports_status ON network_reports(status, created_at);
      `,
    },
    {
      // ⭐ D172 (4) / A154 (45s, owner 11-08: "build league and challenges, can merge them later") · THIS WEEK'S LEAGUE and
      // CHALLENGES, each behind its own switch (app_settings atlas_league_enabled / atlas_challenges_enabled, OFF). A
      // league_members row exists only because the person joined (opt-in), holds their anonymous handle and pod (school ×
      // field × tier), and is DELETED when they leave. challenge_runs: a time attack, a Friday duel (ref = pod#tier#week, the
      // same five questions for the pod) or a kept audit's share link (beat_the_bar, ref = the audit token). Points stay
      // proof-only (proof_points); nothing here pays any. The live count reads answers by time, so they get an index. Only ADDS.
      id: "264_atlas_league",
      sql: `
        CREATE TABLE IF NOT EXISTS league_members (
          user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          handle     TEXT    NOT NULL UNIQUE,
          school     TEXT,
          field      TEXT,
          pod_key    TEXT    NOT NULL,
          tier       INTEGER NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 3),
          joined_at  INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_league_members_pod ON league_members(pod_key, tier);
        CREATE TABLE IF NOT EXISTS challenge_runs (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind            TEXT    NOT NULL CHECK (kind IN ('time_attack', 'friday_duel', 'beat_the_bar')),
          ref             TEXT,
          questions_json  TEXT    NOT NULL,
          answers_json    TEXT    NOT NULL DEFAULT '[]',
          mode            TEXT    NOT NULL DEFAULT 'timed' CHECK (mode IN ('timed', 'extended', 'untimed')),
          score           INTEGER,
          total           INTEGER,
          served_at       INTEGER,
          started_at      INTEGER NOT NULL DEFAULT (unixepoch()),
          finished_at     INTEGER,
          share_code      TEXT UNIQUE
        );
        CREATE INDEX IF NOT EXISTS idx_challenge_runs_user ON challenge_runs(user_id, kind, finished_at);
        CREATE INDEX IF NOT EXISTS idx_challenge_runs_ref ON challenge_runs(kind, ref);
        CREATE INDEX IF NOT EXISTS idx_learn_question_answers_at ON learn_question_answers(answered_at);
      `,
    },
    {
      // ⭐ D151 RULE 4 (45s) · THE NIGHTLY ARCHIVE OF CLOSED POSTINGS — a closed posting older than 120 days that no person's
      // history names moves here whole (its row as JSON, so the archive never breaks when scraped_jobs gains a column) and
      // its derived rows go (services/jobs/postingArchive.js). Behind posting_archive_enabled (OFF). Only ADDS.
      id: "265_posting_archive",
      sql: `
        CREATE TABLE IF NOT EXISTS scraped_jobs_archive (
          job_id       TEXT    PRIMARY KEY,
          archived_at  INTEGER NOT NULL,
          row_json     TEXT    NOT NULL
        );
      `,
    },
    {
      // ⭐ D186 (owner 11-09, "one résumé sets up everything") · which contact / form fields the résumé filled (shown
      // "from your résumé"; a field the person saves leaves the list) and the four things a résumé can't tell us that the
      // person chose to skip (visa status · desired salary · start date · relocate), and the ranking terms a person removed
      // from a job profile (D186-4 — kept removed across résumé replaces). JSON on the person's own rows. Only ADDS.
      id: "266_resume_filled_fields",
      sql: `
        ALTER TABLE user_profile ADD COLUMN resume_filled_json TEXT;
        ALTER TABLE user_profile ADD COLUMN four_things_skipped_json TEXT;
        ALTER TABLE domain_profiles ADD COLUMN keyword_removed_json TEXT;
      `,
    },
    {
      // ⭐ A167 (owner 11-10) · PHASE 1 MONETISATION — the tables behind it, every one behind BILLING_ENABLED / the signup
      // verification switch (both OFF): Stripe customers + subscriptions (written only from verified, idempotent webhooks —
      // billing_events is the ledger of every event id seen), the trial's drafts (10, one per job), the OTP codes (email and
      // SMS; the code and the target stored only as HMACs), a refused sign-up or phone change (masked hints, for the admin),
      // one account per phone (a unique index on the verified E.164 number) and the explicit, OFF-by-default consent to share
      // leads. Only ADDS.
      id: "267_billing_and_verification",
      sql: `
        CREATE TABLE IF NOT EXISTS billing_customers (
          user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          stripe_customer_id  TEXT    NOT NULL UNIQUE,
          livemode            INTEGER NOT NULL DEFAULT 0,
          created_at          INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS billing_subscriptions (
          stripe_subscription_id TEXT    PRIMARY KEY,
          user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          tier                   TEXT,
          price_id               TEXT,
          status                 TEXT    NOT NULL,
          current_period_end     INTEGER,
          cancel_at_period_end   INTEGER NOT NULL DEFAULT 0,
          livemode               INTEGER NOT NULL DEFAULT 0,
          updated_at             INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_billing_subs_user ON billing_subscriptions(user_id, status);
        CREATE TABLE IF NOT EXISTS billing_events (
          stripe_event_id TEXT    PRIMARY KEY,
          type            TEXT    NOT NULL,
          livemode        INTEGER NOT NULL DEFAULT 0,
          received_at     INTEGER NOT NULL DEFAULT (unixepoch()),
          processed_at    INTEGER,
          error           TEXT
        );
        CREATE TABLE IF NOT EXISTS trial_drafts (
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id     TEXT    NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, job_id)
        );
        CREATE TABLE IF NOT EXISTS verify_codes (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          channel     TEXT    NOT NULL CHECK (channel IN ('email', 'sms')),
          target_hash TEXT    NOT NULL,
          code_hash   TEXT,
          provider    TEXT    NOT NULL,
          attempts    INTEGER NOT NULL DEFAULT 0,
          expires_at  INTEGER NOT NULL,
          verified_at INTEGER,
          ip_hash     TEXT,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_verify_codes_target ON verify_codes(channel, target_hash, created_at);
        CREATE INDEX IF NOT EXISTS idx_verify_codes_ip ON verify_codes(ip_hash, created_at);
        CREATE TABLE IF NOT EXISTS signup_refusals (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          reason     TEXT    NOT NULL,
          stage      TEXT    NOT NULL,
          phone_hint TEXT,
          email_hint TEXT,
          user_id    INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        ALTER TABLE users ADD COLUMN phone_e164 TEXT;
        ALTER TABLE users ADD COLUMN phone_verified_at INTEGER;
        ALTER TABLE users ADD COLUMN lead_share_consent INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN lead_share_consent_at INTEGER;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_e164 ON users(phone_e164) WHERE phone_e164 IS NOT NULL;
      `,
    },
    {
      // ⭐ A175 (46d, measured on the 100k fixture): every board read touched scraped_jobs' own row for each candidate — and
      // every column the board reads (is_active, board_category, the rank keys' title / summary / skills_json, the dates) sits
      // AFTER description, description_html, description_text and description_full, so each lookup walked the row's overflow
      // chain (~13 KB a posting). 49k candidates a request: the count 0.85 s, the ordered page 1.4 s (13 s cold). One covering
      // index over the columns the board and its facets read lets SQLite answer them from the index (count 0.37 s, ordered
      // ids 0.82 s on a copy, ~55 MB at 100k, ~5 s to build). And the board-fit pass's “active in my category” count scanned
      // the recency index and read board_category from each row (0.86 s warm, 16 s cold, holding a read worker): a partial
      // index on board_category over active postings answers it from the index (8 ms). And the board's “being matched” read
      // (229's recency walk, newest first, until 2,001 unscored) read board_category from every active row the same way
      // (2.3 s warm, 19 s cold, on each 20-s refresh): 229's index is REPLACED by the same expression carrying job_id and
      // board_category (0.41 s). Only ADDS, but for that one DROP of an index it supersedes. After 267.
      id: "268_scraped_jobs_board_cover",
      sql: `
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_board_cover ON scraped_jobs(job_id, is_active, board_category, ghost_level, title, normalized_title, company, skills_json, summary, tag_basis, tag_function, tag_level, tag_workplace, tag_employment, experience_level, workplace_type, employment_type, category, source, automation_tier, min_years_exp, posted_at, discovered_at, scraped_at);
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_active_category ON scraped_jobs(board_category) WHERE is_active = 1;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_active_recency_cover ON scraped_jobs(COALESCE(posted_at, discovered_at) DESC, job_id, board_category) WHERE is_active = 1;
        DROP INDEX IF EXISTS idx_scraped_jobs_active_recency;
      `,
    },
    {
      // ⭐ A176 (46d): the posting side of A85's “is this stored score current”, KEPT — the fit facet / filter and the board-fit
      // plan hashed every candidate's description per row (9–10 s per facets read at 100k). posting_input_hashes holds each
      // posting's ats_job_input_hash, written only by services/jobs/postingInputHashes.js (one INSERT … SELECT on the writer);
      // these triggers DROP it on any change to a hash input, any insert (a REPLACE re-insert included) and any delete, so
      // every writer invalidates it in SQL. The readers take COALESCE(kept, computed) — the same answer. Only ADDS. After 268.
      id: "269_posting_input_hashes",
      sql: `
        CREATE TABLE IF NOT EXISTS posting_input_hashes (
          job_id     TEXT PRIMARY KEY,
          input_hash TEXT NOT NULL
        ) WITHOUT ROWID;
        CREATE TRIGGER IF NOT EXISTS trg_pih_update AFTER UPDATE OF job_id, title, company, category, description, skills_json, normalized_title, description_text, description_basis ON scraped_jobs
        BEGIN DELETE FROM posting_input_hashes WHERE job_id IN (OLD.job_id, NEW.job_id); END;
        CREATE TRIGGER IF NOT EXISTS trg_pih_insert AFTER INSERT ON scraped_jobs
        BEGIN DELETE FROM posting_input_hashes WHERE job_id = NEW.job_id; END;
        CREATE TRIGGER IF NOT EXISTS trg_pih_delete AFTER DELETE ON scraped_jobs
        BEGIN DELETE FROM posting_input_hashes WHERE job_id = OLD.job_id; END;
      `,
    },
    {
      // ⭐ HB-3 (D187 HB-INFRA, owner 11-09: build the Hirebase infrastructure before any call, so not one is wasted): the
      // landing table (the payload as it may be stored — contact fields and the opaque scores dropped before it is written,
      // services/hirebase/mapJob.js), the runs (each resumable from its cursor, every one through the spend guard), the
      // usage per day × meter (from Hirebase's own Usage headers — the guard's totals), and the posting's link to its
      // source row (source_id = Hirebase's _id, the source ATS's own platform_job_id, first_ingested). Only ADDS. After 269.
      id: "270_hirebase_ingestion",
      sql: `
        CREATE TABLE IF NOT EXISTS hirebase_raw (
          hb_id          TEXT    PRIMARY KEY,
          payload_json   TEXT    NOT NULL,
          first_ingested TEXT,
          md5_hash       TEXT,
          fetched_at     INTEGER NOT NULL DEFAULT (unixepoch()),
          run_id         INTEGER
        );
        CREATE TABLE IF NOT EXISTS hirebase_runs (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          kind        TEXT    NOT NULL CHECK (kind IN ('estimate', 'sample', 'backfill', 'incremental', 'expired')),
          request_json TEXT,
          status      TEXT    NOT NULL DEFAULT 'pending',
          dry_run     INTEGER NOT NULL DEFAULT 1,
          pages_done  INTEGER NOT NULL DEFAULT 0,
          units_used  INTEGER NOT NULL DEFAULT 0,
          max_units   INTEGER,
          cursor_json TEXT,
          counts_json TEXT,
          error       TEXT,
          started_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          finished_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_hirebase_runs_kind ON hirebase_runs(kind, started_at);
        CREATE TABLE IF NOT EXISTS hirebase_usage (
          day                TEXT    NOT NULL,
          meter              TEXT    NOT NULL,
          units              INTEGER NOT NULL DEFAULT 0,
          included_limit     INTEGER,
          included_used      INTEGER,
          included_remaining INTEGER,
          overage_used       INTEGER,
          period_start       TEXT,
          period_end         TEXT,
          updated_at         INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (day, meter)
        );
        ALTER TABLE scraped_jobs ADD COLUMN source_id TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN platform_job_id TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN first_ingested TEXT;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_source_id ON scraped_jobs(source, source_id) WHERE source_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_platform_job ON scraped_jobs(platform_job_id) WHERE platform_job_id IS NOT NULL;
      `,
    },
    {
      // ⭐ T5 · THE ASSISTANT v1 (owner 11-10: "OK ship it"; docs/ASSISTANT.md). assistant_asks = the DE-IDENTIFIED ask log
      // (D177-3: no user id, the question with emails / links / numbers / the person's name stripped, covered / partial /
      // gap) — written only while the person's improve_atlas is on; assistant_actions = every action the assistant
      // PROPOSED and what the person decided (the audit log they see in Profile → Privacy); assistant_prefs = the person's
      // "Use my questions to improve Atlas" switch. Three new small tables — no rewrite of an existing one. After 270.
      id: "271_assistant",
      sql: `
        CREATE TABLE IF NOT EXISTS assistant_asks (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          question     TEXT    NOT NULL,
          coverage     TEXT    NOT NULL CHECK (coverage IN ('covered', 'partial', 'gap')),
          lessons_json TEXT,
          terms_json   TEXT,
          at           INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_assistant_asks_at ON assistant_asks(at);
        CREATE TABLE IF NOT EXISTS assistant_actions (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          tool        TEXT    NOT NULL,
          args_json   TEXT    NOT NULL,
          summary     TEXT,
          status      TEXT    NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'done', 'failed', 'cancelled', 'expired')),
          result_json TEXT,
          proposed_at INTEGER NOT NULL DEFAULT (unixepoch()),
          decided_at  INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_assistant_actions_user ON assistant_actions(user_id, id);
        CREATE TABLE IF NOT EXISTS assistant_prefs (
          user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          improve_atlas INTEGER NOT NULL DEFAULT 1,
          updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
  ];
