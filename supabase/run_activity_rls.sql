-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)

-- Step 0: Drop column if it exists (may have been created as UUID by earlier failed attempt)
ALTER TABLE activity_events DROP COLUMN IF EXISTS organization_id;

-- Step 1: Add organization_id column as TEXT (Clerk org IDs are text like org_xxx)
ALTER TABLE activity_events ADD COLUMN organization_id TEXT;

-- Step 2: Backfill from organization_members
UPDATE activity_events ae
SET organization_id = om.organization_id
FROM organization_members om
WHERE om.user_id = ae.user_id
AND ae.organization_id IS NULL;

-- Step 3: Create index for org-scoped queries
CREATE INDEX IF NOT EXISTS idx_activity_org ON activity_events (organization_id, created_at DESC);

-- Step 4: Enable RLS
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

-- Step 5: Platform admins see all activity
CREATE POLICY platform_admin_all ON activity_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id::text = auth.uid()::text
      AND users.role = 'admin'
    )
  );

-- Step 6: Org admins see their org's activity
CREATE POLICY org_admin_org ON activity_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om1
      JOIN organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id::text = auth.uid()::text
      AND om1.org_role = 'admin'
      AND om2.user_id = activity_events.user_id
    )
  );

-- Step 7: Users see own activity
CREATE POLICY user_own ON activity_events
  FOR SELECT USING (user_id::text = auth.uid()::text);
