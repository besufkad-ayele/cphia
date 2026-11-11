-- Canonicalize older sector spellings so report / volunteer filters match the SECTORS list.
-- Especially: u-report → U-Report (renamed when Ethiopian Youth Council + Serve Global were added).

update public.registrations
set sector = 'U-Report'
where lower(trim(sector)) in ('u-report', 'ureport', 'u report');

update public.registrations
set sector = 'Serve Global'
where lower(replace(trim(sector), ' ', '')) = 'serveglobal'
   or lower(trim(sector)) = 'serve global';

update public.registrations
set sector = 'Ethiopian Youth Council'
where lower(trim(sector)) in (
  'ethiopian youth council',
  'ethiopian youth councle',
  'youth council'
);

update public.registrations
set sector = 'Culture and Sport'
where lower(trim(sector)) in ('culture and sport', 'culture & sport');

update public.registrations
set sector = 'MoFA'
where lower(trim(sector)) = 'mofa';

update public.registrations
set sector = 'UNICEF'
where lower(trim(sector)) = 'unicef';
