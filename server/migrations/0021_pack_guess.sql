-- "Guess" quizzes: alongside your own pick, your guess at your partner's pick.
-- Scored once you've both answered: did you each read the other right?
ALTER TABLE pack_answers ADD COLUMN guess TEXT;
