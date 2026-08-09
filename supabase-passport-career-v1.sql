begin;

alter table public.atlas_passports
  add column if not exists profession text not null default '',
  add column if not exists skills text not null default '';

comment on column public.atlas_passports.profession is
  'Public profession or professional role declared by the Passport owner.';

comment on column public.atlas_passports.skills is
  'Public free-text skills, experience and additional capabilities declared by the Passport owner.';

commit;
