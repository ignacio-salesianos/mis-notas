-- Políticas RLS para la tabla "notes" para permitir compartir notas dentro de carpetas

-- 1. Eliminar cualquier política existente para evitar conflictos
DROP POLICY IF EXISTS "notes_select_policy" ON "public"."notes";
DROP POLICY IF EXISTS "notes_insert_policy" ON "public"."notes";
DROP POLICY IF EXISTS "notes_update_policy" ON "public"."notes";
DROP POLICY IF EXISTS "notes_delete_policy" ON "public"."notes";

-- 2. Política de Lectura (SELECT)
-- Un usuario puede ver una nota si él es el creador (user_id) o si la nota está dentro de una carpeta compartida con su email.
CREATE POLICY "notes_select_policy" ON "public"."notes"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  folder_id IN (
    SELECT folder_id FROM shared_folders WHERE shared_with_email = (SELECT auth.jwt()->>'email')
  )
);

-- 3. Política de Inserción (INSERT)
-- Un usuario puede crear una nota indicando que es el dueño de la nota.
CREATE POLICY "notes_insert_policy" ON "public"."notes"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() OR
  folder_id IN (
    SELECT folder_id FROM shared_folders WHERE shared_with_email = (SELECT auth.jwt()->>'email')
  )
);

-- 4. Política de Actualización (UPDATE)
-- Un usuario puede actualizar una nota si él es el dueño o si la nota está en una carpeta compartida.
CREATE POLICY "notes_update_policy" ON "public"."notes"
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR
  folder_id IN (
    SELECT folder_id FROM shared_folders WHERE shared_with_email = (SELECT auth.jwt()->>'email')
  )
)
WITH CHECK (
  -- Retenemos esta misma condición en la verificación final para no perder acceso después de la actualización
  user_id = auth.uid() OR
  folder_id IN (
    SELECT folder_id FROM shared_folders WHERE shared_with_email = (SELECT auth.jwt()->>'email')
  )
);

-- 5. Política de Eliminación (DELETE)
-- Un usuario puede eliminar notas si él es el dueño o si están en una carpeta compartida.
CREATE POLICY "notes_delete_policy" ON "public"."notes"
AS PERMISSIVE FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() OR
  folder_id IN (
    SELECT folder_id FROM shared_folders WHERE shared_with_email = (SELECT auth.jwt()->>'email')
  )
);
