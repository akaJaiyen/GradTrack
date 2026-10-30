-- Normalize legacy transcript term labels before restricting all future writes.
update public.courses
set year = substring(term from '(19[0-9]{2}|2[0-9]{3}|3000)')::integer
where year is null and term is not null and term ~ '(19[0-9]{2}|2[0-9]{3}|3000)';

update public.courses
set term = case
  when lower(term) ~ 'summer|ฤดูร้อน' then 'summer'
  when lower(term) ~ '(^|[^a-z0-9])(first|1st)([^a-z0-9]|$)|(^|[^a-z0-9])(semester|term|sem)[[:space:]-]*(1|i)([^a-z0-9]|$)|เทอม[[:space:]]*1|ภาคต้น|^[[:space:]]*1[[:space:]]*$' then '1'
  when lower(term) ~ '(^|[^a-z0-9])(second|2nd)([^a-z0-9]|$)|(^|[^a-z0-9])(semester|term|sem)[[:space:]-]*(2|ii)([^a-z0-9]|$)|เทอม[[:space:]]*2|ภาคปลาย|^[[:space:]]*2[[:space:]]*$' then '2'
  when lower(term) ~ '(^|[^a-z0-9])(third|3rd)([^a-z0-9]|$)|(^|[^a-z0-9])(semester|term|sem)[[:space:]-]*(3|iii)([^a-z0-9]|$)|เทอม[[:space:]]*3|^[[:space:]]*3[[:space:]]*$' then '3'
  else null
end
where term is not null;

alter table public.courses drop constraint if exists courses_term_canonical_check;
alter table public.courses add constraint courses_term_canonical_check
  check (term is null or term in ('1', '2', '3', 'summer'));
