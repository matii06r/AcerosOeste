-- Ajustes finales posteriores al setup inicial. Ejecutar con: npx supabase db push

-- Impide que un cliente se asigne el rol admin actualizando su propio perfil.
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'phone',''),
    'customer'
  ) on conflict (id) do nothing;
  return new;
end; $$;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
drop trigger if exists settings_set_updated_at on public.store_settings;
create trigger settings_set_updated_at before update on public.store_settings
for each row execute function public.set_updated_at();

create index if not exists products_active_category_idx on public.products(is_active, category_id);
create index if not exists questions_product_created_idx on public.questions(product_id, created_at desc);
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- Finaliza el pago una sola vez y descuenta el stock de manera idempotente.
create or replace function public.finalize_paid_order(p_order_id uuid, p_payment_id text)
returns void language plpgsql security definer set search_path=public as $$
declare
  current_order public.orders%rowtype;
  next_status text;
begin
  select * into current_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Orden no encontrada'; end if;
  if current_order.status in ('paid','deposit_paid','fulfilled') then return; end if;
  next_status := case when current_order.payment_type='deposit' then 'deposit_paid' else 'paid' end;
  update public.products p
  set stock_quantity=greatest(0,p.stock_quantity-i.quantity)
  from public.order_items i
  where i.order_id=p_order_id and i.product_id=p.id;
  update public.orders set status=next_status,mp_payment_id=p_payment_id where id=p_order_id;
end; $$;
revoke all on function public.finalize_paid_order(uuid,text) from public,anon,authenticated;
grant execute on function public.finalize_paid_order(uuid,text) to service_role;

insert into public.categories(name,slug,sort_order) values
('Mesas de Trabajo','mesas-de-trabajo',10),
('Mesadas con Bacha','mesadas-con-bacha',20),
('Campanas','campanas',30),
('Carros','carros',40),
('Estanterías','estanterias',50)
on conflict(slug) do update set name=excluded.name, sort_order=excluded.sort_order;

insert into public.products(name,slug,description,details,price,stock_quantity,category_id,images,sku,is_active)
select 'Mesa de trabajo reforzada 120×60','mesa-trabajo-reforzada-120x60','Mesa profesional en acero inoxidable con estante inferior, patas reforzadas y regatones regulables.','Fabricación soldada, terminación sanitaria y estructura preparada para uso gastronómico intensivo.',289900,6,id,'{}','MT-120',true from public.categories where slug='mesas-de-trabajo'
on conflict(slug) do nothing;
insert into public.products(name,slug,description,details,price,stock_quantity,category_id,images,sku,is_active)
select 'Mesada con bacha 60×40','mesada-con-bacha-60x40','Mesada sanitaria con bacha profunda, zócalo posterior y estructura totalmente soldada.','Bacha de 60 × 40 cm. Consultá por profundidad, ubicación y largo total a medida.',349500,4,id,'{}','MB-6040',true from public.categories where slug='mesadas-con-bacha'
on conflict(slug) do nothing;
insert into public.products(name,slug,description,details,price,stock_quantity,category_id,images,sku,is_active)
select 'Campana gastronómica 150 cm','campana-gastronomica-150','Campana industrial en acero inoxidable con filtros desmontables. Lista para instalar.','Diseñada para extracción gastronómica. Conducto y motor se cotizan según cada instalación.',425000,2,id,'{}','CG-150',true from public.categories where slug='campanas'
on conflict(slug) do nothing;
insert into public.products(name,slug,description,details,price,stock_quantity,category_id,images,sku,is_active)
select 'Carro de servicio 3 estantes','carro-servicio-3-estantes','Carro utilitario con tres niveles, manijas y ruedas giratorias de alta resistencia.','Ideal para cocinas, salones y depósitos. También disponible en medidas personalizadas.',238000,8,id,'{}','CS-3E',true from public.categories where slug='carros'
on conflict(slug) do nothing;
insert into public.products(name,slug,description,details,price,stock_quantity,category_id,images,sku,is_active)
select 'Estantería inoxidable 4 niveles','estanteria-inoxidable-4-niveles','Estructura robusta y de fácil limpieza para cocinas, depósitos y cámaras.','Cuatro niveles reforzados y patas regulables.',319000,3,id,'{}','ES-4N',true from public.categories where slug='estanterias'
on conflict(slug) do nothing;
insert into public.products(name,slug,description,details,price,stock_quantity,category_id,images,sku,is_active)
select 'Bacha piletón gastronómica 80×60','bacha-pileton-80x60','Piletón gastronómico profundo con estructura de caño y patas regulables.','Construcción íntegra en acero inoxidable. Incluye desagüe; grifería no incluida.',379000,5,id,'{}','BP-8060',true from public.categories where slug='mesadas-con-bacha'
on conflict(slug) do nothing;
insert into public.products(name,slug,description,details,price,stock_quantity,category_id,images,sku,is_active)
select 'Mesa central doble estante 200×60','mesa-central-doble-estante-200x60','Gran superficie de trabajo con dos estantes inferiores y terminación sanitaria.','Formato central sin zócalo, ideal para islas de producción.',489000,1,id,'{}','MC-200',true from public.categories where slug='mesas-de-trabajo'
on conflict(slug) do nothing;
insert into public.products(name,slug,description,details,price,stock_quantity,category_id,images,sku,is_active)
select 'Campana mural compacta 100 cm','campana-mural-compacta-100','Solución compacta para cafeterías y cocinas con espacio reducido.','Fabricación a pedido. Se define salida, filtros y altura según la instalación.',297000,0,id,'{}','CG-100',true from public.categories where slug='campanas'
on conflict(slug) do nothing;

-- Asegura que la cuenta ya creada conserve el rol administrativo.
update public.profiles set role='admin'
where id=(select id from auth.users where email='gestionacerosoeste@gmail.com');
