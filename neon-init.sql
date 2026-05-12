-- Opcional: podés pegar esto en el SQL Editor de Neon.
-- La app también crea la tabla sola en el primer guardado.

CREATE TABLE IF NOT EXISTS biblioteca_lp_state (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
