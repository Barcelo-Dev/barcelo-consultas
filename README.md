# Barceló Guatemala City — Portal de consultas

Web independiente (protegida con login) para ver y exportar los correos que
llegan desde el formulario público. Comparte la base de datos de Supabase con
la web del formulario.

## Puesta en marcha
1. `npm install`
2. En Supabase, ejecuta una sola vez el esquema `supabase/schema.sql`
   (SQL Editor > New query > pegar > Run). Crea la tabla y las políticas.
3. **Crea el usuario admin**: Supabase > Authentication > Users > Add user.
   Pon un correo y contraseña. Con eso inicias sesión en el portal.
4. **Desactiva el registro público**: Authentication > Providers > Email,
   y desactiva "Enable sign ups". Así nadie más puede crear cuentas.
5. Copia `.env.example` a `.env.local` con la URL y la **anon key** de Supabase.
6. `npm run dev` → http://localhost:3000 (te pedirá iniciar sesión).

## Qué hace
- Login del personal autorizado (Supabase Auth).
- Tabla de registros con búsqueda y filtro (confirmados / pendientes).
- Estadísticas: total, confirmados, cupones redimidos.
- **Exportar CSV** de los registros filtrados (se abre bien en Excel).

## Seguridad
- El dashboard está protegido por middleware: sin sesión, redirige a /login.
- Los registros se leen con el rol `authenticated` (política RLS). El público
  nunca accede a la lista.
- No usa la service_role key: esta web solo lee, con la sesión del admin.
