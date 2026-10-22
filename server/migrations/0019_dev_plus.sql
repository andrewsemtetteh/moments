-- Settings › Developer › "Pretend Plus is on": the server treats the space as Plus too, so
-- every Plus feature (restoring a streak, AI games, unlimited moments) really works while
-- testing. Only the accounts listed in the DEV_TOOLS_USER_IDS secret can switch it on.
ALTER TABLE relationships ADD COLUMN dev_plus INTEGER NOT NULL DEFAULT 0;
