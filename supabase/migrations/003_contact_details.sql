-- Ajustes públicos finales de contacto.
update public.store_settings
set address_1 = 'Av. San Martín 4092',
    address_2 = null,
    updated_at = now()
where id = 1;
