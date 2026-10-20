-- server/schema.sql: הטבלה של הסטודיו ב-Supabase.
-- מריצים פעם אחת: Supabase > SQL Editor > מדביקים > Run.
--
-- כל המידע בטבלה אחת של רשומות. coll = סוג המידע (סטודנטים, סדנאות, הגדרות...), id = מזהה הרשומה.
-- data ריק (null) = רשומה שנמחקה. rev = מספר גרסה שעולה בכל שמירה.

create table if not exists public.records (
  coll        text        not null,
  id          text        not null,
  data        jsonb,
  rev         bigint      not null,
  updated_at  timestamptz not null default now(),
  primary key (coll, id)
);

create index if not exists records_rev on public.records (rev);

-- נעילה: הגישה לטבלה רק דרך השרת של הסטודיו (עם המפתח הסודי).
-- אין שום הרשאה למפתח הציבורי, כך שאף אחד מבחוץ לא יכול לקרוא או לכתוב.
alter table public.records enable row level security;
revoke all on public.records from anon, authenticated;
-- הרשאה מפורשת רק לשרת (המפתח הסודי), כי בפרויקט כבויה החשיפה האוטומטית של טבלאות חדשות
grant select, insert, update, delete on public.records to service_role;
