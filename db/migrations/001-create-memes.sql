CREATE TABLE IF NOT EXISTS memes (
  id BIGSERIAL PRIMARY KEY,
  template_name VARCHAR(100) NOT NULL,
  top_text VARCHAR(500) NOT NULL DEFAULT '',
  bottom_text VARCHAR(500) NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING',
      'PROCESSING',
      'COMPLETED',
      'FAILED',
      'QUEUE_FAILED'
    )),
  image_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memes_created_at
  ON memes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memes_status
  ON memes (status);
