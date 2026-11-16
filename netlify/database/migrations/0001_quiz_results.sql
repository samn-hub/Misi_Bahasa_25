CREATE TABLE quiz_results (
 id uuid PRIMARY KEY,
 pupil text NOT NULL,
 name text NOT NULL,
 classroom text NOT NULL,
 alias text NOT NULL,
 score integer NOT NULL CHECK (score BETWEEN 0 AND 25),
 answers text NOT NULL,
 created bigint NOT NULL
);
CREATE INDEX quiz_results_scores ON quiz_results(pupil,score DESC,created);
