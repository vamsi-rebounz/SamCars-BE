-- Add email verification fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS verification_token VARCHAR(64),
ADD COLUMN IF NOT EXISTS verification_token_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE; 