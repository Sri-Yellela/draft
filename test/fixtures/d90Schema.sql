-- The tables D90 reads and writes, as a migrated draft database holds them BEFORE migration 157 (copied 2026-10-10). The tests apply 157.
CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          is_admin INTEGER NOT NULL DEFAULT 0,
          apply_mode TEXT NOT NULL DEFAULT 'SIMPLE',
          apify_token TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        , domain_profile_complete INTEGER NOT NULL DEFAULT 0, enhance_used INTEGER NOT NULL DEFAULT 0, enhance_paid INTEGER NOT NULL DEFAULT 0, plan_tier TEXT NOT NULL DEFAULT 'BASIC', google_auth_id TEXT, linkedin_auth_id TEXT, github_auth_id TEXT, aplus_resume INTEGER NOT NULL DEFAULT 0, form_schema_capture INTEGER NOT NULL DEFAULT 0, theme_preference TEXT, password_set INTEGER NOT NULL DEFAULT 0, avatar_path TEXT, email_verified_at INTEGER, deck_geometry TEXT, base_resume_only INTEGER NOT NULL DEFAULT 0, board_seen_at INTEGER, board_prev_seen_at INTEGER, byom_enabled INTEGER NOT NULL DEFAULT 0, marketing_opt_in INTEGER NOT NULL DEFAULT 0, marketing_opt_in_at INTEGER, marketing_opt_in_source TEXT, unsubscribed_at INTEGER, status TEXT NOT NULL DEFAULT 'active', suspended_reason TEXT, suspended_at INTEGER);

CREATE TABLE user_profile (
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
        , first_name TEXT, middle_name TEXT, last_name TEXT, name_suffix TEXT, confirmed_skills TEXT NOT NULL DEFAULT '[]', target_skills    TEXT NOT NULL DEFAULT '[]', target_domains   TEXT NOT NULL DEFAULT '[]', target_locations TEXT NOT NULL DEFAULT '[]', seniority_level  TEXT, onboarded        INTEGER NOT NULL DEFAULT 0, website_url TEXT, portfolio_url TEXT, desired_salary INTEGER, salary_currency TEXT, available_start_date TEXT, willing_to_relocate INTEGER NOT NULL DEFAULT 0, highest_degree TEXT, field_of_study TEXT, university TEXT, graduation_year INTEGER, current_job_title TEXT, current_company TEXT, years_of_experience INTEGER, custom_answers TEXT NOT NULL DEFAULT '{}', sponsorship_need TEXT, custom_answer_overrides TEXT NOT NULL DEFAULT '{}');

CREATE TABLE resumes (
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
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()), ats_cache_key TEXT, ats_prompt_version TEXT, domain_profile_id INTEGER, base_ats_score INTEGER, parsed_json TEXT, parsed_basis TEXT,
          UNIQUE(user_id, job_id)
        );

CREATE TABLE resume_versions (
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
        , tool_type TEXT NOT NULL DEFAULT 'generate', is_kept INTEGER NOT NULL DEFAULT 0, ats_cache_key TEXT, ats_prompt_version TEXT, base_ats_score INTEGER);

CREATE TABLE base_resume (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          name TEXT,
          content TEXT NOT NULL,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        , enhanced_at INTEGER, enhanced_content TEXT, enhanced_ats_delta INTEGER, parsed_json TEXT, parsed_basis TEXT);

CREATE TABLE job_applications (
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
          notes TEXT, auto_status TEXT, screenshot_path TEXT, ats_score_at_apply INTEGER, ats_scorer_version TEXT, ats_report_at_apply TEXT, ats_scored_at INTEGER, response_outcome TEXT, furthest_stage TEXT, first_response_at INTEGER, outcome_at INTEGER, outcome_source TEXT, salary_min INTEGER, salary_max INTEGER, salary_currency TEXT, company_domain TEXT,
          UNIQUE(user_id, job_id)
        );

CREATE TABLE scraped_jobs (
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
        , compensation TEXT, company_icon_url TEXT, source_platform TEXT, apply_url TEXT, salary_min REAL, salary_max REAL, salary_currency TEXT, description_html TEXT, applicant_count INTEGER, min_years_exp REAL, max_years_exp REAL, exp_raw TEXT, employment_type TEXT, domain_profile_id INTEGER REFERENCES domain_profiles(id) ON DELETE SET NULL, ats_score INTEGER, ats_report TEXT, bucket_role      TEXT, bucket_seniority TEXT, bucket_domain    TEXT, direct_apply     INTEGER NOT NULL DEFAULT 1, source_label     TEXT, via TEXT, collar TEXT, classification_confidence REAL, normalized_title      TEXT, summary               TEXT, experience_level      TEXT, workplace_type        TEXT, valid_through         INTEGER, salary_min_usd        INTEGER, salary_max_usd        INTEGER, salary_period         TEXT, skills_json           TEXT, is_h1b_sponsor        INTEGER, requires_work_auth    INTEGER, is_clearance_required INTEGER, discovered_at         INTEGER, updated_at            INTEGER, is_active INTEGER NOT NULL DEFAULT 1, fingerprint   TEXT, sources_seen  TEXT, content_hash TEXT, enriched_at  INTEGER, req_uid TEXT, org_unit_raw TEXT, automation_tier TEXT, enrichment_batch_id INTEGER, detail_fetched_at     INTEGER, detail_fetch_attempts INTEGER NOT NULL DEFAULT 0, detail_fetch_error    TEXT, duplicate_of   TEXT, retired_reason TEXT, retired_at     INTEGER, tag_level TEXT, tag_function TEXT, tag_employment TEXT, tag_workplace TEXT, tag_remote INTEGER, tag_us TEXT, tag_basis TEXT, tag_version INTEGER, tag_owner_json TEXT, tagged_at INTEGER, description_text TEXT, description_fields TEXT, description_basis TEXT, req_citizenship TEXT, req_clearance TEXT, req_clearance_status TEXT, req_polygraph INTEGER, pay_text_min_usd INTEGER, pay_text_max_usd INTEGER, description_full TEXT, enrichment_partial INTEGER NOT NULL DEFAULT 0, enrichment_provenance TEXT);

CREATE TABLE user_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          visited INTEGER NOT NULL DEFAULT 0,
          applied INTEGER NOT NULL DEFAULT 0,
          starred INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()), disliked INTEGER NOT NULL DEFAULT 0, resume_generated INTEGER NOT NULL DEFAULT 0, domain_profile_id INTEGER REFERENCES domain_profiles(id) ON DELETE SET NULL,
          UNIQUE(user_id, job_id)
        );

CREATE TABLE domain_profiles (
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
        , tracked_search_json TEXT, include_summary INTEGER NOT NULL DEFAULT 0, generate_at_queue INTEGER NOT NULL DEFAULT 0);

CREATE UNIQUE INDEX idx_domain_profiles_active
          ON domain_profiles(user_id) WHERE is_active = 1;

CREATE UNIQUE INDEX idx_users_google_auth_id
          ON users(google_auth_id) WHERE google_auth_id IS NOT NULL;

CREATE UNIQUE INDEX idx_users_linkedin_auth_id
          ON users(linkedin_auth_id) WHERE linkedin_auth_id IS NOT NULL;

CREATE UNIQUE INDEX idx_users_github_auth_id
          ON users(github_auth_id) WHERE github_auth_id IS NOT NULL;

CREATE TABLE profile_base_resumes (
          profile_id INTEGER PRIMARY KEY REFERENCES domain_profiles(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT,
          content TEXT NOT NULL,
          enhanced_content TEXT,
          enhanced_at INTEGER,
          enhanced_ats_delta INTEGER,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        , parsed_json TEXT, parsed_basis TEXT);

CREATE TABLE profile_signal_suggestions (
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
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()), queue_state TEXT NOT NULL DEFAULT 'none', assertion TEXT NOT NULL DEFAULT 'none', claimed_at INTEGER,
          UNIQUE(profile_id, signal_key)
        );

CREATE TABLE application_records (
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

CREATE TABLE application_artifacts (
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
