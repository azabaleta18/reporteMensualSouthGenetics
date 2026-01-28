-- ============================================
-- Migración: Eliminar triggers, políticas RLS y función que usan fecha_ultimo_mov / saldo_ultimo_mov
-- ============================================
--
-- Las columnas fecha_ultimo_mov y saldo_ultimo_mov fueron eliminadas de la
-- tabla cuenta. El error "column c.fecha_ultimo_mov does not exist" puede
-- venir de:
--   1) La función fn_update_cuenta_desde_mov (actualiza c.fecha_ultimo_mov y c.saldo_ultimo_mov)
--   2) Un TRIGGER en "movimiento" cuya función actualiza cuenta.fecha_ultimo_mov
--   3) Una política RLS en "movimiento" que referencia cuenta.fecha_ultimo_mov
--
-- Ejecutar en: Supabase → SQL Editor (o usar MCP).
-- ============================================

-- ---------- 0) ELIMINAR la función fn_update_cuenta_desde_mov (origen frecuente del error) ----------
DROP FUNCTION IF EXISTS public.fn_update_cuenta_desde_mov() CASCADE;

-- ---------- 1) DIAGNÓSTICO (opcional): descomenta y ejecuta solo esto para ver qué hay ----------
/*
SELECT 'TRIGGERS en movimiento' AS tipo, t.tgname AS nombre, pg_get_functiondef(p.oid) AS definicion
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'movimiento' AND NOT t.tgisinternal
UNION ALL
SELECT 'POLÍTICAS RLS' AS tipo, p.polname AS nombre,
  COALESCE(pg_get_expr(p.polqual, p.polrelid),'') || ' | ' || COALESCE(pg_get_expr(p.polwithcheck, p.polrelid),'') AS definicion
FROM pg_policy p
WHERE p.polrelid = 'movimiento'::regclass;
*/

-- ---------- 2) ELIMINAR triggers en "movimiento" que referencian esas columnas ----------
DO $$
DECLARE
  r RECORD;
  fn text;
BEGIN
  FOR r IN
    SELECT t.tgname AS tgname, t.tgfoid AS fnoid
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'movimiento' AND NOT t.tgisinternal
  LOOP
    fn := COALESCE((SELECT p.prosrc FROM pg_proc p WHERE p.oid = r.fnoid), '');
    IF fn LIKE '%fecha_ultimo_mov%' OR fn LIKE '%saldo_ultimo_mov%' THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON movimiento', r.tgname);
      RAISE NOTICE 'Eliminado trigger % en movimiento.', r.tgname;
    END IF;
  END LOOP;
END $$;

-- ---------- 3) ELIMINAR políticas RLS en "movimiento" que referencian esas columnas ----------
DO $$
DECLARE
  r RECORD;
  expr text;
BEGIN
  FOR r IN
    SELECT p.polname, p.polqual, p.polwithcheck, p.polrelid
    FROM pg_policy p
    WHERE p.polrelid = 'movimiento'::regclass
  LOOP
    expr := COALESCE(pg_get_expr(r.polqual, r.polrelid), '') || ' ' || COALESCE(pg_get_expr(r.polwithcheck, r.polrelid), '');
    IF expr LIKE '%fecha_ultimo_mov%' OR expr LIKE '%saldo_ultimo_mov%' THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON movimiento', r.polname);
      RAISE NOTICE 'Eliminada política RLS % en movimiento.', r.polname;
    END IF;
  END LOOP;
END $$;

-- ---------- 4) PLAN B: si sigue fallando, probar eliminando TODOS los triggers no internos en movimiento ----------
-- (Descomenta y ejecuta solo si lo anterior no resolvió.)
/*
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT t.tgname FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'movimiento' AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON movimiento', r.tgname);
    RAISE NOTICE 'Eliminado trigger % en movimiento.', r.tgname;
  END LOOP;
END $$;
*/
