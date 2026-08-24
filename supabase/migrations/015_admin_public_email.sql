-- Actualiza el correo público y administrativo sin modificar las credenciales
-- de acceso en auth.users. El administrador puede seguir ingresando con su
-- correo anterior hasta confirmar el cambio desde Supabase Auth.

update public.store_settings
set contact_email = 'gestionacerosoestee@gmail.com'
where id = 1;

update public.profiles
set email = 'gestionacerosoestee@gmail.com'
where role = 'admin'
  and (
    email is null
    or lower(email) = 'gestionacerosoeste@gmail.com'
  );
