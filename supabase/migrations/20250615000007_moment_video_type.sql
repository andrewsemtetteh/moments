-- Video moments (photo + video only in the app UI)
DO $$ BEGIN
  ALTER TYPE moment_type ADD VALUE 'video';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
