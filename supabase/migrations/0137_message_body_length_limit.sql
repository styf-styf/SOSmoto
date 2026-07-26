-- FIX MENOR: messages.body no tenía límite de tamaño -- permitía payloads
-- arbitrariamente grandes sin límite de tasa. 4000 caracteres es generoso
-- para un chat de texto normal.
alter table messages add constraint messages_body_length check (char_length(body) <= 4000);
