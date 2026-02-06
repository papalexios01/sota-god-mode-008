/*
  # Fix RLS Policies for generated_blog_posts

  1. Changes
    - Drop the insecure "Allow all operations" policy (was USING (true))
    - Add `user_id` column (uuid, references auth.users) for ownership tracking
    - Default user_id to auth.uid() for new rows inserted via Supabase client

  2. New Policies (per-operation, restrictive)
    - Authenticated users can SELECT their own posts
    - Authenticated users can INSERT posts (ownership enforced via WITH CHECK)
    - Authenticated users can UPDATE their own posts
    - Authenticated users can DELETE their own posts

  3. Security
    - RLS remains enabled
    - All policies require authentication and ownership
    - Existing rows with NULL user_id are accessible to any authenticated user
      until ownership is assigned
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generated_blog_posts' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE generated_blog_posts
      ADD COLUMN user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();
  END IF;
END $$;

DROP POLICY IF EXISTS "Allow all operations" ON generated_blog_posts;

CREATE POLICY "Authenticated users can read own posts"
  ON generated_blog_posts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Authenticated users can insert own posts"
  ON generated_blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own posts"
  ON generated_blog_posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete own posts"
  ON generated_blog_posts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);
