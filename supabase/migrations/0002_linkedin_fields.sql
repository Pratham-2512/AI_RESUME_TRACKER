-- LinkedIn OAuth fields on the single-user profile
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS linkedin_access_token TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_token_expiry  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS linkedin_sub           TEXT;   -- LinkedIn person sub/ID
