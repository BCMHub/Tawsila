begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(36);

select is(current_setting('server_encoding'), 'UTF8', 'V11 UTF8 server encoding');

select is(public.plate_is_valid('1'), true, 'G4 synthetic form 1');

select is(public.plate_is_valid('1234'), true, 'G4 synthetic form 2');

select is(public.plate_is_valid('12345'), false, 'G4 synthetic form 3');

select is(public.plate_is_valid('ب1'), true, 'G4 synthetic form 4');

select is(public.plate_is_valid('ب1234'), true, 'G4 synthetic form 5');

select is(public.plate_is_valid('ابتث1'), true, 'G4 synthetic form 6');

select is(public.plate_is_valid('ابتث1234'), true, 'G4 synthetic form 7');

select is(public.plate_is_valid('1ب'), true, 'G4 synthetic form 8');

select is(public.plate_is_valid('1234ب'), true, 'G4 synthetic form 9');

select is(public.plate_is_valid('1ابتث'), true, 'G4 synthetic form 10');

select is(public.plate_is_valid('1234ابتث'), true, 'G4 synthetic form 11');

select is(public.plate_is_valid('ابتثج1'), false, 'G4 synthetic form 12');

select is(public.plate_is_valid('1ابتثج'), false, 'G4 synthetic form 13');

select is(public.plate_is_valid('ABC1'), false, 'G4 synthetic form 14');

select is(public.plate_is_valid('بَ1'), false, 'G4 synthetic form 15');

select is(public.plate_is_valid(''), false, 'G4 synthetic form 16');

select is(public.plate_is_valid('ب1ب'), false, 'G4 synthetic form 17');

select is(public.plate_is_valid('ب'), false, 'G4 synthetic form 18');

select is(public.plate_is_valid('ءأإآ1'), true, 'G4 synthetic form 19');

select is(public.plate_normalized('١٢٣٤'), '1234', 'normalization before validation');

select is(public.plate_normalized(' ب - ١٢ '), 'ب12', 'normalization before validation');

select is(public.plate_normalized('بـ١'), 'ب1', 'normalization before validation');

select is(public.plate_normalized('１'), '1', 'normalization before validation');

select is(public.plate_normalized('ﺏ١'), 'ب1', 'normalization before validation');

select is('ب' ~ '^[ءآأؤإئابتثجحخدذرزسشصضطظعغفقكلمنهويىة]{1,4}$', true, 'V11 explicit code points under database collation');

select is('ءأإآ' ~ '^[ءآأؤإئابتثجحخدذرزسشصضطظعغفقكلمنهويىة]{1,4}$', true, 'V11 explicit code points under database collation');

select is('بَ' ~ '^[ءآأؤإئابتثجحخدذرزسشصضطظعغفقكلمنهويىة]{1,4}$', false, 'V11 explicit code points under database collation');

select is('A' ~ '^[ءآأؤإئابتثجحخدذرزسشصضطظعغفقكلمنهويىة]{1,4}$', false, 'V11 explicit code points under database collation');

select is(public.plate_normalized('۰۱۲۳۴۵۶۷۸۹'), '0123456789', 'Extended Arabic-Indic digits normalized');
select ok(public.plate_is_valid('۱۲۳۴'), 'extended digits accepted');
select ok(public.plate_is_valid('بـ-۱٢'), 'mixed digit sets normalized');
select ok(public.plate_is_valid('۱۲ب'), 'extended digits before letters');
select ok(not public.plate_is_valid('۱۲۳۴۵'), 'extended digits respect maximum');
select ok(not public.plate_is_valid('بَ۱'), 'extended digits do not permit diacritics');
select ok(not public.plate_is_valid('۱ب۲'), 'extended digits do not permit interleaving');
reset role;
select * from finish();
rollback;
