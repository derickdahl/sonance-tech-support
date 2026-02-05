-- Support Issues Table - for logging issues from VAPI calls
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS support_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  sku TEXT,
  issue TEXT NOT NULL,
  caller_info TEXT,
  severity TEXT DEFAULT 'medium',
  notes TEXT,
  source TEXT DEFAULT 'vapi_call',
  status TEXT DEFAULT 'new',
  assigned_to TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Index for faster queries
CREATE INDEX idx_support_issues_status ON support_issues(status);
CREATE INDEX idx_support_issues_created ON support_issues(created_at DESC);

-- Enable RLS
ALTER TABLE support_issues ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" ON support_issues
  FOR ALL USING (true);
